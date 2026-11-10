export interface Person {
  id: string;
  name: string;
  cpf: string;
  phone: string;
  email: string;
  city: string;
  region: string;
  role: string;
  management: string;
  supervisor: string;
  level: "Administrador" | "Coordenador" | "Operacional" | "Supervisor";
  status: "Ativo" | "Inativo" | "Bloqueado";
  photo?: string;
  createdAt: string;
}

export interface Material {
  id: string;
  name: string;
  type: string;
  totalQty: number;
  availableQty: number;
  distributedQty: number;
  unitPrice: number;
  totalPrice: number;
  management: string;
  responsible: string;
  city: string;
  sentDate: string;
  status: "Disponível" | "Em trânsito" | "Entregue" | "Esgotado";
}

export interface Movement {
  id: string;
  materialId: string;
  materialName: string;
  type: "Entrada" | "Saída" | "Devolução";
  quantity: number;
  responsible: string;
  city: string;
  date: string;
  notes?: string;
}

export const MATERIAL_TYPES = [
  "Santinho", "Banner", "Adesivo", "Outdoor", "Camiseta", "Boné", "Bandeira", "Panfleto", "Cartaz"
] as const;

export const REGIONS = [
  "Região Metropolitana", "Norte", "Sul", "Leste", "Oeste", "Litoral", "Sertão", "Agreste"
] as const;
