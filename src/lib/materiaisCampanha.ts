import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Itens de material de campanha na ordem oficial. */
export const ITENS_MATERIAL = [
  { key: "santinhos", label: "Santinho", short: "Santinho" },
  { key: "wind_banner", label: "Wind-Banner", short: "Wind-Banner" },
  { key: "adesivo_perfurado", label: "Perfurado", short: "Perfurado" },
  { key: "adesivo_parachoque", label: "Adesivo Parachoque", short: "Ad. Parachoque" },
  { key: "praguinha", label: "Praguinha", short: "Praguinha" },
  { key: "panfleto", label: "Panfleto", short: "Panfleto" },
  { key: "flayer", label: "Flayer", short: "Flayer" },
] as const;

export type ItemKey = (typeof ITENS_MATERIAL)[number]["key"];

export type Quantidades = Record<ItemKey, number>;

export type FormulaItem = { auto: boolean; fator: number };
export type Formulas = Record<ItemKey, FormulaItem>;

export const FORMULAS_SETTING_KEY = "planejamento_material_formulas";

export function formulasPadrao(): Formulas {
  return ITENS_MATERIAL.reduce((acc, i) => {
    acc[i.key] = { auto: false, fator: 0 };
    return acc;
  }, {} as Formulas);
}

export function parseFormulas(value?: string | null): Formulas {
  const base = formulasPadrao();
  if (!value) return base;
  try {
    const parsed = JSON.parse(value);
    ITENS_MATERIAL.forEach(i => {
      const f = parsed?.[i.key];
      if (f) base[i.key] = { auto: !!f.auto, fator: Number(f.fator) || 0 };
    });
  } catch {
    /* mantém padrão */
  }
  return base;
}

export function zeroQuantidades(): Quantidades {
  return ITENS_MATERIAL.reduce((acc, i) => {
    acc[i.key] = 0;
    return acc;
  }, {} as Quantidades);
}

export function calcularQuantidades(
  plano: Partial<Record<ItemKey, number | null>> | undefined,
  votos: number,
  formulas: Formulas,
): Quantidades {
  const out = zeroQuantidades();
  ITENS_MATERIAL.forEach(i => {
    const manual = plano?.[i.key];
    if (manual !== null && manual !== undefined) {
      out[i.key] = manual;
      return;
    }
    const f = formulas[i.key];
    out[i.key] = f?.auto ? Math.round(votos * (f.fator || 0)) : 0;
  });
  return out;
}

const SELECT_COLS = ["id", "cidade_id", "coordenador_user_id", ...ITENS_MATERIAL.map(i => i.key), "observacoes"].join(", ");

/** Chave composta cidade + coordenador (sem coordenador = "-"). */
export const planoKey = (cidadeId: string, coordUserId?: string | null) => `${cidadeId}::${coordUserId || "-"}`;

/** Planejamento salvo, votos por cidade e fórmulas configuradas. */
export function useMaterialPlanejamento() {
  const planos = useQuery({
    queryKey: ["planejamento-logistico"],
    queryFn: async () => {
      const { data, error } = await supabase.from("planejamento_logistico").select(SELECT_COLS);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const liderancas = useQuery({
    queryKey: ["planejamento-liderancas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("liderancas").select("cidade_base_id, votos_estimados");
      if (error) throw error;
      return data || [];
    },
  });

  const projecoes = useQuery({
    queryKey: ["planejamento-projecoes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projecao_votos").select("cidade_id, votos_projetados");
      if (error) throw error;
      return data || [];
    },
  });

  const settings = useQuery({
    queryKey: ["app-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("app_settings").select("key, value");
      if (error) throw error;
      const map: Record<string, string | null> = {};
      (data || []).forEach((r: any) => { map[r.key] = r.value; });
      return map;
    },
  });

  const formulas = useMemo(
    () => parseFormulas(settings.data?.[FORMULAS_SETTING_KEY]),
    [settings.data],
  );

  const votosPorCidade = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of (liderancas.data || []) as any[]) {
      if (!l.cidade_base_id) continue;
      map.set(l.cidade_base_id, (map.get(l.cidade_base_id) || 0) + (l.votos_estimados || 0));
    }
    for (const p of (projecoes.data || []) as any[]) {
      if (!p.cidade_id) continue;
      if (!map.get(p.cidade_id)) map.set(p.cidade_id, p.votos_projetados || 0);
    }
    return map;
  }, [liderancas.data, projecoes.data]);

  /** Mapa por chave composta cidade::coordenador. */
  const planoMap = useMemo(
    () => new Map<string, any>((planos.data || []).map((p: any) => [planoKey(p.cidade_id, p.coordenador_user_id), p])),
    [planos.data],
  );

  /** Compatibilidade: agregado por cidade (soma de todos os coordenadores). */
  const quantidadesPorCidade = useMemo(() => {
    const out = new Map<string, Quantidades & { editado: boolean }>();
    const cidadesComPlano = new Set<string>((planos.data || []).map((p: any) => p.cidade_id));
    const ids = new Set<string>([...votosPorCidade.keys(), ...cidadesComPlano]);
    ids.forEach(id => {
      const linhas = (planos.data || []).filter((p: any) => p.cidade_id === id);
      if (linhas.length === 0) {
        out.set(id, { ...calcularQuantidades(undefined, votosPorCidade.get(id) || 0, formulas), editado: false });
        return;
      }
      const soma = zeroQuantidades();
      linhas.forEach((l: any) => {
        const q = calcularQuantidades(l, votosPorCidade.get(id) || 0, formulas);
        ITENS_MATERIAL.forEach(i => { soma[i.key] += q[i.key]; });
      });
      out.set(id, { ...soma, editado: true });
    });
    return out;
  }, [votosPorCidade, planos.data, formulas]);

  return {
    isLoading: planos.isLoading || liderancas.isLoading || projecoes.isLoading || settings.isLoading,
    formulas,
    planoMap,
    votosPorCidade,
    quantidadesPorCidade,
  };
}
