import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

// All available modules in the system
export const ALL_MODULES = [
  { key: "painel", label: "Painel Unificado" },
  { key: "dashboard_eleitoral", label: "Dashboard Eleitoral" },
  { key: "mapa", label: "Mapa Eleitoral" },
  { key: "cidades", label: "Cidades" },
  { key: "liderancas", label: "Lideranças" },
  { key: "dobradinhas", label: "Dobradinhas" },
  { key: "projecoes", label: "Projeção de Votos" },
  { key: "estrutura", label: "Estrutura" },
  { key: "agenda", label: "Agenda" },
  { key: "agenda_conjunta", label: "Agenda Conjunta (ver todos)" },
  { key: "visitas", label: "Visitas" },
  { key: "relatorios", label: "Relatórios" },
  { key: "leads", label: "Leads & Contatos" },
  { key: "leads_full", label: "Ver TODOS os apoiadores captados" },
  { key: "log_dashboard", label: "Painel Logístico" },
  { key: "log_materiais", label: "Materiais" },
  { key: "log_estoque", label: "Estoque" },
  { key: "log_distribuicao", label: "Distribuição" },
  { key: "log_solicitacoes", label: "Solicitações de Material" },
  { key: "log_solicitacoes_gestao", label: "Gerenciar Status das Solicitações" },
  
  { key: "log_financeiro", label: "Financeiro" },
  { key: "log_auditoria", label: "Auditoria" },
  { key: "log_relatorios", label: "Rel. Logísticos" },
  { key: "radar_social", label: "Radar Social" },
  { key: "configuracoes", label: "Configurações" },
  { key: "arquivo", label: "Arquivo" },
  { key: "campo_planejamento", label: "Planejamento de Campo" },
  { key: "campo_painel", label: "Painel de Campo" },
  { key: "whatsapp_envio", label: "Envio por WhatsApp" },
  { key: "santinho", label: "Meu Santinho (gerar imagem)" },
] as const;

export type ModuleKey = typeof ALL_MODULES[number]["key"];

// Map route paths to module keys
export const ROUTE_MODULE_MAP: Record<string, string> = {
  "/": "painel",
  "/dashboard-eleitoral": "dashboard_eleitoral",
  "/mapa": "mapa",
  "/cidades": "cidades",
  "/liderancas": "liderancas",
  "/dobradinhas": "dobradinhas",
  "/projecoes": "projecoes",
  "/estrutura": "estrutura",
  "/agenda": "agenda",
  "/visitas": "visitas",
  "/relatorios": "relatorios",
  "/leads": "leads",
  "/log-dashboard": "log_dashboard",
  "/log-materiais": "log_materiais",
  "/log-estoque": "log_estoque",
  "/log-distribuicao": "log_distribuicao",
  "/log-solicitacoes": "log_solicitacoes",
  
  "/log-financeiro": "log_financeiro",
  "/log-auditoria": "log_auditoria",
  "/log-relatorios": "log_relatorios",
  "/radar-social": "radar_social",
  "/configuracoes": "configuracoes",
  "/arquivo": "arquivo",
  "/campo-planejamento": "campo_planejamento",
  "/campo-painel": "campo_painel",
  "/whatsapp": "whatsapp_envio",
  "/santinho": "santinho",
  "/usuarios": "usuarios", // admin-only, not in ALL_MODULES
  "/contato-coordenacao": "contato_coordenacao", // admin-only, not in ALL_MODULES
};

export function useUserPermissions() {
  const { user, userRole } = useAuth();

  return useQuery({
    queryKey: ["user-permissions", user?.id],
    queryFn: async () => {
      if (!user?.id) return [] as string[];
      const { data, error } = await supabase.rpc("get_user_permissions", { _user_id: user.id });
      if (error) throw error;
      return (data || []) as string[];
    },
    enabled: !!user?.id,
  });
}

/**
 * Check if user has access to a given module.
 * Admin always has access to everything.
 * Other roles: check user_permissions table. If no permissions are set, deny access (except admin).
 */
export function hasModuleAccess(
  userRole: string | null,
  permissions: string[],
  moduleKey: string
): boolean {
  // Financial module requires explicit permission even for admins
  if (moduleKey === "log_financeiro") return permissions.includes("log_financeiro");
  // Leads & Contatos: liberado para todos os usuários autenticados.
  // A visibilidade dos dados é controlada por RLS (admin vê tudo, coordenador vê sua equipe,
  // liderança vê suas captações, captador vê apenas o que ele captou).
  if (moduleKey === "leads") return true;
  if (userRole === "admin") return true;
  if (moduleKey === "usuarios") return false; // only admin
  if (moduleKey === "contato_coordenacao") return false; // only admin
  // WhatsApp: apenas administradores e usuários explicitamente autorizados podem enviar mensagens.
  if (moduleKey === "whatsapp_envio") {
    return permissions.includes("whatsapp_envio");
  }
  // Santinho: controlado individualmente pelo administrador via permissão explícita
  if (moduleKey === "santinho") {
    return permissions.includes("santinho");
  }
  return permissions.includes(moduleKey);
}

/**
 * Hook utilitário: retorna true se o usuário atual pode enviar mensagens via WhatsApp.
 * Admin sempre pode; demais precisam da permissão explícita `whatsapp_envio`.
 */
export function useCanSendWhatsApp(): boolean {
  const { userRole } = useAuth();
  const { data: permissions = [] } = useUserPermissions();
  if (userRole === "admin") return true;
  return permissions.includes("whatsapp_envio");
}

/**
 * Quem pode gerar o Santinho (consome créditos de IA):
 * admin sempre; demais SOMENTE com a permissão explícita `santinho`,
 * liberada individualmente pelo administrador em Usuários > Permissões.
 */
export function useCanUseSantinho(): boolean {
  const { userRole } = useAuth();
  const { data: permissions = [] } = useUserPermissions();

  if (userRole === "admin") return true;
  return permissions.includes("santinho");
}
