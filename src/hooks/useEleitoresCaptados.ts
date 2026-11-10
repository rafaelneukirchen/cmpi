import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface EleitorCaptado {
  id: string;
  lideranca_id: string | null;
  captado_por_user_id: string | null;
  tipo_captador: "lideranca" | "usuario";
  nome_completo: string;
  telefone: string | null;
  bairro: string | null;
  cidade_id: string | null;
  cidade_nome: string | null;
  zona_eleitoral: string | null;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  observacoes: string | null;
  origem: string;
  created_at: string;
}

async function fetchAllCaptados<T>(columns: string, eqCol?: string, eqVal?: string): Promise<T[]> {
  const pageSize = 1000;
  let from = 0;
  const all: T[] = [];
  // eslint-disable-next-line no-constant-condition
  while (true) {
    let q = supabase.from("eleitores_captados" as never).select(columns).order("created_at", { ascending: false }).range(from, from + pageSize - 1);
    if (eqCol && eqVal) q = (q as { eq: (c: string, v: string) => typeof q }).eq(eqCol, eqVal);
    const { data, error } = await q;
    if (error) throw error;
    const chunk = (data ?? []) as unknown as T[];
    all.push(...chunk);
    if (chunk.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

export function useEleitoresCaptados(liderancaId?: string | null) {
  const { session, loading } = useAuth();
  return useQuery({
    queryKey: ["eleitores-captados", liderancaId ?? "all", session?.user?.id],
    enabled: !loading && !!session,
    queryFn: async () => {
      return await fetchAllCaptados<EleitorCaptado>("*", liderancaId ? "lideranca_id" : undefined, liderancaId ?? undefined);
    },
  });
}

/** Returns a map of liderancaId -> count of captured voters */
export function useEleitoresCaptadosCountByLideranca() {
  const { session, loading } = useAuth();
  return useQuery({
    queryKey: ["eleitores-captados-count-by-lideranca", session?.user?.id],
    enabled: !loading && !!session,
    queryFn: async () => {
      const rows = await fetchAllCaptados<{ lideranca_id: string | null }>("lideranca_id");
      const map = new Map<string, number>();
      for (const row of rows) {
        if (!row.lideranca_id) continue;
        map.set(row.lideranca_id, (map.get(row.lideranca_id) ?? 0) + 1);
      }
      return map;
    },
  });
}

/** Returns a map of user_id -> count of captured voters (captação por usuário do sistema) */
export function useEleitoresCaptadosCountByUsuario() {
  const { session, loading } = useAuth();
  return useQuery({
    queryKey: ["eleitores-captados-count-by-usuario", session?.user?.id],
    enabled: !loading && !!session,
    queryFn: async () => {
      const rows = await fetchAllCaptados<{ captado_por_user_id: string | null }>("captado_por_user_id");
      const map = new Map<string, number>();
      for (const row of rows) {
        if (!row.captado_por_user_id) continue;
        map.set(row.captado_por_user_id, (map.get(row.captado_por_user_id) ?? 0) + 1);
      }
      return map;
    },
  });
}
