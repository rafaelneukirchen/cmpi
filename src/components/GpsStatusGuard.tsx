import { useEffect, useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MapPin, Loader2, AlertTriangle } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

const CHECK_INTERVAL_MS = 12 * 60 * 60 * 1000; // 12 horas

/**
 * Garante que todos os usuários abaixo de administrador estejam com o GPS
 * ativo. Se estiver desligado/negado, exibe notificação e um aviso bloqueante
 * pedindo a ativação.
 */
export function GpsStatusGuard() {
  const { user, userRole, isSuperAdmin } = useAuth();
  const [gpsOk, setGpsOk] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);

  const isAdmin = userRole === "admin" || isSuperAdmin;

  // Só exige GPS de quem já aceitou o termo de localização
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

  const checkGps = useCallback(async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        const res = await Geolocation.checkPermissions();
        const granted = res.location === "granted" || res.coarseLocation === "granted";
        if (!granted) return false;
        await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 15000 });
        return true;
      }

      if (!("geolocation" in navigator)) return false;
      if (navigator.permissions?.query) {
        try {
          const status = await navigator.permissions.query({ name: "geolocation" as PermissionName });
          if (status.state === "granted") return true;
          if (status.state === "denied") return false;
          // "prompt": tenta obter a posição abaixo (dispara o pedido do navegador)
        } catch {
          /* alguns navegadores não suportam */
        }
      }
      return await new Promise<boolean>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          () => resolve(true),
          () => resolve(false),
          { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }
        );
      });
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    if (!user || isAdmin || !consent?.is_active) {
      setGpsOk(null);
      return;
    }
    let active = true;

    const run = async () => {
      const ok = await checkGps();
      if (!active) return;
      setGpsOk((prev) => {
        if (!ok && prev !== false) {
          toast.error("GPS desativado. Ative a localização para continuar usando o sistema.", {
            duration: 8000,
          });
        }
        return ok;
      });
    };

    run();
    const id = window.setInterval(run, CHECK_INTERVAL_MS);
    const onFocus = () => run();
    window.addEventListener("focus", onFocus);
    return () => {
      active = false;
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [user, isAdmin, consent?.is_active, checkGps]);

  async function handleActivate() {
    setChecking(true);
    try {
      if (Capacitor.isNativePlatform()) {
        await Geolocation.requestPermissions({ permissions: ["location", "coarseLocation"] });
      }
      const ok = await checkGps();
      setGpsOk(ok);
      if (ok) toast.success("GPS ativo. Obrigado!");
      else
        toast.error(
          "Não foi possível ativar. Habilite a localização nas configurações do dispositivo/navegador e tente de novo.",
          { duration: 8000 }
        );
    } finally {
      setChecking(false);
    }
  }

  const open = gpsOk === false;

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            GPS desativado
          </DialogTitle>
          <DialogDescription>
            Sua localização precisa estar ativa enquanto você utiliza o sistema. Ative o GPS e
            permita o acesso à localização para continuar.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground flex gap-2">
          <MapPin className="h-4 w-4 mt-0.5 text-primary shrink-0" />
          <span>
            Se já permitiu antes, verifique se o GPS do aparelho está ligado e se o navegador/app
            tem permissão de localização.
          </span>
        </div>

        <DialogFooter>
          <Button onClick={handleActivate} disabled={checking} className="w-full sm:w-auto">
            {checking && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Ativar localização
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
