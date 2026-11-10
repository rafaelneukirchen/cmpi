import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TseCandidato {
  id: string;
  nome_urna: string;
  nome_completo: string | null;
  numero_candidato: string;
  cargo: string;
  sigla_partido: string | null;
  nome_partido: string | null;
  municipio: string | null;
  codigo_municipio: string | null;
  ano_eleicao: number;
  situacao: string | null;
  total_votos: number;
}

export interface TseVotosMunicipio {
  id: string;
  candidato_id: string;
  municipio: string;
  codigo_municipio: string | null;
  zona_eleitoral: string | null;
  total_votos: number;
  ano_eleicao: number;
}

export function useTseAnosDisponiveis() {
  return useQuery({
    queryKey: ["tse-anos-disponiveis"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tse_candidatos")
        .select("ano_eleicao")
        .order("ano_eleicao", { ascending: false });
      if (error) throw error;
      const set = new Set<number>();
      (data || []).forEach((r: any) => set.add(r.ano_eleicao));
      return Array.from(set).sort((a, b) => b - a);
    },
    staleTime: 1000 * 60 * 10,
  });
}

export function useTseBusca(search: string, ano?: number | null) {
  return useQuery({
    queryKey: ["tse-busca", search, ano ?? "all"],
    queryFn: async () => {
      if (!search || search.length < 3) return [];
      let q = supabase
        .from("tse_candidatos")
        .select("*")
        .ilike("nome_urna", `%${search}%`)
        .order("total_votos", { ascending: false })
        .limit(20);
      if (ano) q = q.eq("ano_eleicao", ano);
      const { data, error } = await q;
      if (error) throw error;
      return data as TseCandidato[];
    },
    enabled: search.length >= 3,
  });
}

export function useTseVotos(candidatoId: string | null) {
  return useQuery({
    queryKey: ["tse-votos", candidatoId],
    queryFn: async () => {
      if (!candidatoId) return [];
      const { data, error } = await supabase
        .from("tse_votos_municipio")
        .select("*")
        .eq("candidato_id", candidatoId)
        .order("total_votos", { ascending: false });
      if (error) throw error;
      return data as TseVotosMunicipio[];
    },
    enabled: !!candidatoId,
  });
}
