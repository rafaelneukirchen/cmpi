import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const TIPO_ACAO_OPTIONS = [
  { value: "panfletagem_semaforo", label: "Panfletagem em semáforo" },
  { value: "panfletagem_feira", label: "Panfletagem em feira" },
  { value: "corpo_a_corpo_residencial", label: "Corpo a corpo residencial" },
  { value: "corpo_a_corpo_comercial", label: "Corpo a corpo comercial" },
  { value: "bandeiraco", label: "Bandeiraço" },
  { value: "adesivaco", label: "Adesivaço" },
  { value: "caminhada", label: "Caminhada" },
  { value: "carreata", label: "Carreata" },
  { value: "motociata", label: "Motociata" },
  { value: "reuniao_comunitaria", label: "Reunião comunitária" },
  { value: "evento_liderancas", label: "Evento de lideranças" },
  { value: "visita_institucional", label: "Visita institucional" },
] as const;

export type TipoAcao = (typeof TIPO_ACAO_OPTIONS)[number]["value"];

export const labelTipo = (v: string) =>
  TIPO_ACAO_OPTIONS.find((o) => o.value === v)?.label ?? v;

export function useCidadesSelect() {
  return useQuery({
    queryKey: ["campo-cidades-opt-all"],
    queryFn: async () => {
      // Usa RPC SECURITY DEFINER para retornar TODOS os municípios,
      // ignorando o filtro regional de RLS aplicado em `cidades`.
      const { data, error } = await supabase.rpc("get_cidades_options");
      if (!error && data && data.length > 0) {
        return (data as any[]).map((c) => ({ id: c.id, nome: c.nome }));
      }
      const { data: fb, error: fbErr } = await supabase
        .from("cidades")
        .select("id, nome")
        .order("nome");
      if (fbErr) throw error || fbErr;
      return (fb || []) as { id: string; nome: string }[];
    },
    staleTime: 5 * 60_000,
  });
}

export function useLiderancasSelect() {
  return useQuery({
    queryKey: ["campo-lid-opt"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("liderancas")
        .select("id, nome, cidade_base_id")
        .order("nome");
      if (error) throw error;
      return data as { id: string; nome: string; cidade_base_id: string | null }[];
    },
    staleTime: 5 * 60_000,
  });
}

export function useCoordenadoresSelect() {
  return useQuery({
    queryKey: ["campo-coord-opt"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, nome")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as { user_id: string; nome: string | null }[];
    },
    staleTime: 5 * 60_000,
  });
}

export async function getCurrentPosition(): Promise<{ lat: number; lng: number } | null> {
  if (!("geolocation" in navigator)) return null;
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  });
}
