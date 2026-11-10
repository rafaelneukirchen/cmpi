import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Tables } from "@/integrations/supabase/types";

export type CaboEleitoral = Tables<"cabos_eleitorais">;

export function useCabosEleitorais() {
  const { session, loading } = useAuth();
  return useQuery({
    queryKey: ["cabos_eleitorais", session?.user?.id],
    enabled: !loading && !!session,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cabos_eleitorais")
        .select("*")
        .order("nome");
      if (error) throw error;
      return (data || []) as CaboEleitoral[];
    },
  });
}

export interface CoordenadorRegional {
  user_id: string;
  nome: string;
  email: string | null;
  cor: string | null;
  total_cidades: number;
  total_lideres: number;
  total_cabos: number;
  total_votos_estimados: number;
}

export function useCoordenadoresRegionais() {
  const { session, loading } = useAuth();
  return useQuery({
    queryKey: ["coordenadores_regionais", session?.user?.id],
    enabled: !loading && !!session,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_coordenadores_regionais");
      if (error) throw error;
      return ((data as any[]) || []).map((r) => ({
        user_id: r.user_id,
        nome: r.nome,
        email: r.email,
        cor: r.cor,
        total_cidades: Number(r.total_cidades || 0),
        total_lideres: Number(r.total_lideres || 0),
        total_cabos: Number(r.total_cabos || 0),
        total_votos_estimados: Number(r.total_votos_estimados || 0),
      })) as CoordenadorRegional[];
    },
  });
}
