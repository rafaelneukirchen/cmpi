import { useEffect, useRef, useCallback } from "react";
import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";
import { Device } from "@capacitor/device";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";

interface LocationPayload {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  speed?: number | null;
  heading?: number | null;
  altitude?: number | null;
  battery_level?: number | null;
}

/**
 * Hook que gerencia o envio periódico da localização do usuário
 * para o Supabase. Funciona tanto no navegador (foreground) quanto
 * no app nativo (Capacitor) — em background usa @capacitor-community/background-geolocation
 * (configurado em capacitor.config.ts).
 */
export function useLocationTracking() {
  const { user } = useAuth();
  const intervalRef = useRef<number | null>(null);
  const watcherIdRef = useRef<string | null>(null);

  const { data: consent } = useQuery({
    queryKey: ["user-location-consent", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("user_location_consent")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  const sendLocation = useCallback(
    async (payload: LocationPayload) => {
      if (!user?.id) return;
      try {
        await supabase.from("user_locations").insert({
          user_id: user.id,
          ...payload,
        });
      } catch (err) {
        console.error("[LocationTracking] insert error", err);
      }
    },
    [user?.id]
  );

  const captureCurrentPosition = useCallback(async () => {
    try {
      let battery: number | null = null;
      if (Capacitor.isNativePlatform()) {
        try {
          const info = await Device.getBatteryInfo();
          battery = info.batteryLevel != null ? Math.round(info.batteryLevel * 100) : null;
        } catch {}
      }

      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 15000,
      });

      await sendLocation({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        speed: pos.coords.speed,
        heading: pos.coords.heading,
        altitude: pos.coords.altitude,
        battery_level: battery,
      });
    } catch (err) {
      console.warn("[LocationTracking] capture error", err);
    }
  }, [sendLocation]);

  useEffect(() => {
    // Rastreia no app nativo e também no navegador (foreground) quando há consentimento
    if (!user?.id || !consent?.is_active) {
      return;
    }


    const frequencyMs = (consent.frequency_minutes || 15) * 60 * 1000;

    // Captura inicial
    captureCurrentPosition();

    // Foreground (web e nativo): intervalo regular
    intervalRef.current = window.setInterval(() => {
      captureCurrentPosition();
    }, frequencyMs);

    // Watcher contínuo (recebe atualizações quando há movimento significativo)
    Geolocation.watchPosition(
      { enableHighAccuracy: true },
      (pos, err) => {
        if (err || !pos) return;
        // Throttle: ignora se distância for menor que ~50m do último envio
        // (envio principal é o setInterval; aqui só serve para contexto)
      }
    )
      .then((id) => {
        watcherIdRef.current = id;
      })
      .catch(() => {});

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (watcherIdRef.current) {
        Geolocation.clearWatch({ id: watcherIdRef.current }).catch(() => {});
        watcherIdRef.current = null;
      }
    };
  }, [user?.id, consent?.is_active, consent?.frequency_minutes, captureCurrentPosition]);

  return { consent, captureCurrentPosition };
}
