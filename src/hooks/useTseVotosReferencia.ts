import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const CANDIDATO_REFERENCIA = "FELIPE CARMONA";
export const ANO_REFERENCIA = 2022;

export const normalizeCidade = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

export interface VotosCidadeRef {
  total: number;
  zonas: { zona: string; votos: number }[];
}

/**
 * Votos do candidato de referência (Felipe Carmona / 2022) agregados por município.
 * Chave do Map = nome do município normalizado.
 */
export function useTseVotosReferencia() {
  return useQuery({
    queryKey: ["tse-votos-referencia", CANDIDATO_REFERENCIA, ANO_REFERENCIA],
    staleTime: 1000 * 60 * 30,
    queryFn: async () => {
      const { data: cand, error: e1 } = await supabase
        .from("tse_candidatos")
        .select("id")
        .eq("ano_eleicao", ANO_REFERENCIA)
        .ilike("nome_urna", CANDIDATO_REFERENCIA)
        .maybeSingle();
      if (e1) throw e1;
      const map = new Map<string, VotosCidadeRef>();
      if (!cand?.id) return map;

      const { data, error } = await supabase
        .from("tse_votos_municipio")
        .select("municipio, zona_eleitoral, total_votos")
        .eq("candidato_id", cand.id);
      if (error) throw error;

      for (const row of data || []) {
        const key = normalizeCidade(row.municipio);
        if (!key) continue;
        const entry = map.get(key) || { total: 0, zonas: [] };
        entry.total += row.total_votos || 0;
        if (row.zona_eleitoral) {
          entry.zonas.push({ zona: row.zona_eleitoral, votos: row.total_votos || 0 });
        }
        map.set(key, entry);
      }
      for (const entry of map.values()) {
        entry.zonas.sort((a, b) => b.votos - a.votos);
      }
      return map;
    },
  });
}
