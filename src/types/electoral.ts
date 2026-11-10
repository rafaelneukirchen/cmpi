export type ForcaPolitica = 'baixa' | 'media' | 'alta';
export type StatusLideranca = 'ativa' | 'potencial' | 'em_negociacao';
export type NivelConfianca = 'baixo' | 'medio' | 'alto';
export type TipoEvento = 'reuniao' | 'comicio' | 'visita' | 'carreata' | 'debate';
export type UserRole = 'admin' | 'coordenador_estadual' | 'coordenador_regional' | 'operador_cadastro' | 'analista_eleitoral';

export interface Estado {
  id: string;
  nome: string;
  sigla: string;
}

export interface Cidade {
  id: string;
  nome: string;
  estado_id: string;
  regiao_administrativa: string;
  populacao: number;
  eleitores: number;
  densidade_populacional: number;
  pib_municipal: number;
  latitude: number;
  longitude: number;
  area_territorial: number;
  observacoes?: string;
}

export interface Lideranca {
  id: string;
  nome: string;
  telefone?: string;
  whatsapp?: string;
  cidade_base_id: string;
  cidades_representadas: string[];
  forca_politica: ForcaPolitica;
  status: StatusLideranca;
  historico_politico?: string;
  observacoes?: string;
}

export interface ProjecaoVotos {
  id: string;
  cidade_id: string;
  lideranca_id?: string;
  votos_projetados: number;
  votos_confirmados: number;
  meta_votos: number;
  nivel_confianca: NivelConfianca;
  data_atualizacao: string;
  responsavel: string;
  observacoes?: string;
}

export interface EstruturaCampanha {
  id: string;
  cidade_id: string;
  cabos_eleitorais: number;
  apoiadores: number;
  veiculos: number;
  materiais_distribuidos: number;
}

export interface VisitaCampanha {
  id: string;
  cidade_id: string;
  lideranca_id?: string;
  data_visita: string;
  equipe_responsavel: string;
  objetivo: string;
  resultado?: string;
  relatorio?: string;
}

export interface AgendaCampanha {
  id: string;
  cidade_id: string;
  evento: string;
  data: string;
  responsavel: string;
  tipo_evento: TipoEvento;
}

export interface DashboardStats {
  totalVotosProjetados: number;
  totalVotosConfirmados: number;
  metaGeral: number;
  percentualMeta: number;
  totalCidades: number;
  totalLiderancas: number;
  cidadesSemLideranca: number;
}
