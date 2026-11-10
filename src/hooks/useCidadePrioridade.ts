import { useMemo } from "react";

export interface CidadePrioridade {
  cidadeId: string;
  nome: string;
  eleitores: number;
  regiao: string;
  nivel: 'critica' | 'alta' | 'media' | 'baixa';
  score: number; // 0-100, higher = needs more attention
  motivos: string[];
  gap: number; // votos faltantes para meta
  metaVotos: number;
  votosAtuais: number; // projetados ou estimados via lideranças
  liderancasCount: number;
  temEstrutura: boolean;
  temCoordenador: boolean;
}

interface PrioridadeInput {
  cidades: Array<{ id: string; nome: string; eleitores: number | null; regiao_administrativa: string | null }>;
  projMap: Map<string, { meta_votos: number | null; votos_projetados: number | null; votos_confirmados: number | null }>;
  votosEstimadosByCidade: Map<string, number>;
  liderancasByCidade: Map<string, Array<{ coordenador_user_id: string | null }>>;
  estruturaMap: Map<string, any>;
}

export function calcularPrioridades({
  cidades,
  projMap,
  votosEstimadosByCidade,
  liderancasByCidade,
  estruturaMap,
}: PrioridadeInput): CidadePrioridade[] {
  return cidades.map(c => {
    const proj = projMap.get(c.id);
    const estVotos = votosEstimadosByCidade.get(c.id) || 0;
    const lids = liderancasByCidade.get(c.id) || [];
    const temEstrutura = estruturaMap.has(c.id);
    const temCoordenador = lids.some(l => l.coordenador_user_id);
    const eleitores = c.eleitores || 0;

    const metaVotos = proj?.meta_votos || 0;
    const votosProjetados = proj?.votos_projetados || 0;
    const votosAtuais = votosProjetados || estVotos;
    const gap = Math.max(0, metaVotos - votosAtuais);

    const motivos: string[] = [];
    let score = 0;

    // 1. Gap de meta (0-40 pts)
    if (metaVotos > 0) {
      const ratio = votosAtuais / metaVotos;
      if (ratio < 0.25) { score += 40; motivos.push(`Apenas ${Math.round(ratio * 100)}% da meta`); }
      else if (ratio < 0.5) { score += 30; motivos.push(`${Math.round(ratio * 100)}% da meta`); }
      else if (ratio < 0.75) { score += 15; motivos.push(`${Math.round(ratio * 100)}% da meta`); }
    } else if (eleitores > 5000) {
      score += 25;
      motivos.push("Sem meta definida");
    }

    // 2. Sem lideranças (0-25 pts)
    if (lids.length === 0 && eleitores > 3000) {
      score += 25;
      motivos.push("Sem lideranças");
    } else if (lids.length === 1 && eleitores > 10000) {
      score += 10;
      motivos.push("Apenas 1 liderança");
    }

    // 3. Sem coordenador (0-15 pts)
    if (!temCoordenador && lids.length > 0) {
      score += 15;
      motivos.push("Sem coordenador");
    } else if (!temCoordenador && eleitores > 5000) {
      score += 10;
      motivos.push("Sem coordenador");
    }

    // 4. Sem estrutura (0-10 pts)
    if (!temEstrutura && eleitores > 5000) {
      score += 10;
      motivos.push("Sem estrutura");
    }

    // 5. Potencial eleitoral alto amplifica a urgência (0-10 pts)
    if (eleitores > 50000) { score += 10; }
    else if (eleitores > 20000) { score += 5; }

    // Normalizar score para 0-100
    score = Math.min(100, score);

    const nivel: CidadePrioridade['nivel'] =
      score >= 60 ? 'critica' :
      score >= 40 ? 'alta' :
      score >= 20 ? 'media' : 'baixa';

    return {
      cidadeId: c.id,
      nome: c.nome,
      eleitores,
      regiao: c.regiao_administrativa || '-',
      nivel,
      score,
      motivos,
      gap,
      metaVotos,
      votosAtuais,
      liderancasCount: lids.length,
      temEstrutura,
      temCoordenador,
    };
  })
  .filter(p => p.score > 0)
  .sort((a, b) => b.score - a.score);
}
