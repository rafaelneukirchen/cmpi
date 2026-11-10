import {
  LayoutDashboard, Map, Building2, Users, BarChart3, Tent, Calendar,
  MapPin, FileText, UserCog, Vote, LogOut, Settings, Archive,
  Package, Truck, Warehouse, DollarSign, ClipboardList, Shield,
  Radar, Brain, Navigation, Contact, PhoneCall, MessageCircle, Lock, KeyRound,
  Presentation, Compass, Briefcase, Wifi, ShieldCheck, Sparkles, Target, CalendarRange,
  Route, ChevronDown,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/hooks/useAuth";
import { useAppSettings } from "@/hooks/useAppSettings";
import { useUserPermissions, hasModuleAccess, ROUTE_MODULE_MAP, useCanUseSantinho } from "@/hooks/useUserPermissions";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { VotoQrDialog } from "@/components/VotoQrDialog";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";

const mainItems = [
  { title: "Painel Unificado", url: "/", icon: LayoutDashboard },
  { title: "Dashboard Eleitoral", url: "/dashboard-eleitoral", icon: BarChart3 },
  { title: "Mapa Eleitoral", url: "/mapa", icon: Map },
  { title: "Cidades", url: "/cidades", icon: Building2 },
  { title: "Líderes & Cabos", url: "/liderancas", icon: Users },
  { title: "Dobrada", url: "/dobradinhas", icon: Vote },
  { title: "Projeção de Apoiadores", url: "/projecoes", icon: BarChart3 },
];

const operationItems = [
  { title: "Apoiadores Captados", url: "/eleitores-captados", icon: Vote },
  { title: "Estrutura", url: "/estrutura", icon: Tent },
  { title: "Agenda", url: "/agenda", icon: Calendar },
  { title: "Visitas", url: "/visitas", icon: MapPin },
  { title: "Rastreamento", url: "/rastreamento", icon: Navigation },
  { title: "Planejamento de Campo", url: "/campo-planejamento", icon: ClipboardList },
  { title: "Execução de Campo", url: "/campo-execucao", icon: Compass },
  { title: "Painel de Campo", url: "/campo-painel", icon: BarChart3 },
];

const logisticsItems = [
  { title: "Painel Logístico", url: "/log-dashboard", icon: LayoutDashboard },
  { title: "Materiais", url: "/log-materiais", icon: Package },
  { title: "Estoque", url: "/log-estoque", icon: Warehouse },
  { title: "Distribuição", url: "/log-distribuicao", icon: Truck },
  { title: "Solicitações", url: "/log-solicitacoes", icon: ClipboardList },
  { title: "Material de Campanha", url: "/log-planejamento", icon: ClipboardList },
  { title: "Melhor Itinerário", url: "/log-itinerario", icon: Route },
  
  
  { title: "Financeiro", url: "/log-financeiro", icon: DollarSign },
  { title: "Auditoria", url: "/log-auditoria", icon: Shield },
  { title: "Rel. Logísticos", url: "/log-relatorios", icon: ClipboardList },
];

const socialItems = [
  { title: "Radar Social", url: "/radar-social", icon: Radar },
  { title: "Inteligência", url: "/inteligencia", icon: Brain },
  { title: "WhatsApp", url: "/whatsapp", icon: MessageCircle },
];

const adminItems = [
  { title: "Contato Coordenação", url: "/contato-coordenacao", icon: PhoneCall },
  { title: "Leads & Contatos", url: "/leads", icon: Contact },
  { title: "Relatórios", url: "/relatorios", icon: FileText },
  { title: "Cidades Representadas", url: "/relatorios/cidades-representadas", icon: MapPin },
  { title: "Meta de Captação", url: "/relatorios/meta-captacao", icon: Target },
  { title: "Rel. Planejamento Campo", url: "/relatorios/planejamento-campo", icon: CalendarRange },
  { title: "Bairros por Cidade", url: "/relatorios/bairros-cidades", icon: MapPin },
  { title: "Conferência de Leads", url: "/relatorios/conferencia-leads", icon: ClipboardList },
  { title: "Usuários", url: "/usuarios", icon: UserCog },
  { title: "Arquivo", url: "/arquivo", icon: Archive },
  { title: "Configurações", url: "/configuracoes", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { signOut, user, userRole, isSuperAdmin } = useAuth();
  const { data: settings } = useAppSettings();
  const { data: permissions = [] } = useUserPermissions();
  const navigate = useNavigate();
  const location = useLocation();

  // Token público do usuário logado para o botão "VOTO" (captação rápida em campo)
  const canUseSantinho = useCanUseSantinho();

  const { data: myProfile } = useQuery({
    queryKey: ["my-profile-token", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("token_publico, nome")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const canAccess = (url: string) => {
    const moduleKey = ROUTE_MODULE_MAP[url];
    if (!moduleKey) return true;
    return hasModuleAccess(userRole, permissions, moduleKey);
  };

  const filterItems = (items: typeof mainItems) => items.filter(i => {
    // Rastreamento: admin e coordenadores (qualquer usuário logado vê seu link/equipe)
    return canAccess(i.url);
  });

  const handleLogout = async () => {
    await signOut();
    navigate("/auth");
  };

  const isCaptador = userRole === "operador_cadastro";
  const captadorAllowed = new Set<string>(["/campo-execucao", "/leads", "/eleitores-captados"]);
  const captadorFilter = <T extends { url: string }>(items: T[]) =>
    isCaptador ? items.filter(i => captadorAllowed.has(i.url)) : items;

  const filteredMain = captadorFilter(filterItems(mainItems));
  const filteredOps = captadorFilter(filterItems(operationItems));
  const filteredLog = captadorFilter(filterItems(logisticsItems));
  const filteredSocial = captadorFilter(filterItems(socialItems));
  const filteredAdmin = captadorFilter(filterItems(adminItems));

  // Lista de grupos (accordion). Cada grupo vira um botão que abre/fecha seus itens.
  const groups = useMemo(() => [
    { key: "principal", label: "Principal", icon: Compass, items: filteredMain },
    { key: "operacoes", label: "Operações", icon: Briefcase, items: filteredOps },
    { key: "logistica", label: "Logística", icon: Truck, items: filteredLog },
    { key: "social", label: "Redes Sociais", icon: Wifi, items: filteredSocial },
    { key: "administracao", label: "Administração", icon: ShieldCheck, items: filteredAdmin },
  ].filter(g => g.items.length > 0), [filteredMain, filteredOps, filteredLog, filteredSocial, filteredAdmin]);

  const vendasItems = isSuperAdmin ? [
    { to: "/admin-vendas", icon: KeyRound, title: "Licenças & Vendas", tooltip: "Gestão de Licenças" },
    { to: "/leads-centralizados", icon: Contact, title: "Leads Centralizados", tooltip: "Leads de todos os clones" },
    { to: "/apresentacao", icon: Presentation, title: "Apresentação", tooltip: "Apresentação do Sistema" },
  ] : [];

  // Descobre o grupo ativo pela rota atual para abrir automaticamente.
  const activeGroup = useMemo(() => {
    const all = [...filteredMain, ...filteredOps, ...filteredLog, ...filteredSocial, ...filteredAdmin];
    const match = all.find(i => i.url === location.pathname || location.pathname.startsWith(i.url + "/"));
    if (!match) {
      if (vendasItems.some(v => location.pathname === v.to || location.pathname.startsWith(v.to + "/"))) return "vendas";
      return null;
    }
    const g = groups.find(gg => gg.items.includes(match as never));
    return g?.key ?? null;
  }, [groups, location.pathname, filteredMain, filteredOps, filteredLog, filteredSocial, filteredAdmin, vendasItems]);

  const [openGroup, setOpenGroup] = useState<string | null>(activeGroup);
  // Sincroniza quando a rota muda
  useEffect(() => setOpenGroup(activeGroup), [activeGroup]);

  const toggleGroup = (key: string) => setOpenGroup(prev => prev === key ? null : key);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border pb-4">
        <div className="flex items-center gap-3 px-2">
          {settings?.app_logo ? (
            <img src={settings.app_logo} alt="Logo" className="h-14 w-14 rounded-lg object-contain" />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-lg electoral-gradient">
              <Vote className="h-8 w-8 text-white" />
            </div>
          )}
          {!collapsed && (
            <div className="flex flex-col">
              {settings?.app_name ? (
                <span className="text-sm font-bold tracking-tight text-sidebar-foreground leading-tight">
                  {settings.app_name}
                </span>
              ) : (
                <>
                  <span className="text-sm font-bold tracking-tight text-sidebar-foreground">Inteligência</span>
                  <span className="text-xs text-sidebar-foreground/70">Eleitoral</span>
                </>
              )}
            </div>
          )}
        </div>
        {!collapsed && settings?.candidato_nome && (
          <div className="mx-2 mt-3 rounded-md border border-primary/30 bg-primary/10 px-3 py-2">
            <p className="uppercase tracking-wider font-semibold text-lg text-primary-foreground">Dep estadual</p>
            <p className="text-sm font-bold text-sidebar-foreground leading-tight truncate">
              {settings.candidato_nome}
            </p>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent>
        {/* Botão VOTO sempre visível para todos os usuários logados */}
        {myProfile?.token_publico && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <VotoQrDialog
                    token={myProfile.token_publico}
                    nome={myProfile.nome || user?.email || "Captador"}
                    trigger={
                      <SidebarMenuButton
                        tooltip="APOIADORES — Captar apoiador em campo"
                        className="!bg-primary !text-primary-foreground hover:!bg-primary/90 font-extrabold border-2 border-primary shadow-lg ring-2 ring-primary/40 animate-pulse-slow"
                      >
                        <Vote className="h-4 w-4" />
                        {!collapsed && <span className="underline underline-offset-4 decoration-2 tracking-widest text-base">APOIADORES</span>}
                      </SidebarMenuButton>
                    }
                  />
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Botão Meu Santinho — coordenadores, lideranças, admin ou permissão */}
        {canUseSantinho && (
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Meu Santinho">
                  <NavLink
                    to="/santinho"
                    className="group/nav relative rounded-md transition-all hover:bg-sidebar-accent/60"
                    activeClassName="bg-sidebar-primary/15 text-sidebar-primary font-semibold ring-1 ring-sidebar-primary/25 before:absolute before:left-0 before:top-1/2 before:h-5 before:w-0.5 before:-translate-y-1/2 before:rounded-r-full before:bg-sidebar-primary"
                  >
                    <Sparkles className="h-4 w-4 transition-transform group-hover/nav:scale-110" />
                    {!collapsed && <span className="truncate">Meu Santinho</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        )}

        {groups.map((group) => {
          const isOpen = collapsed || openGroup === group.key;
          return (
            <SidebarGroup
              key={group.key}
              className="sidebar-group-card"
              data-collapsed={collapsed ? "true" : "false"}
            >
              <button
                type="button"
                onClick={() => !collapsed && toggleGroup(group.key)}
                className="sidebar-group-header w-full text-left"
                aria-expanded={isOpen}
              >
                <span className="sidebar-group-header-icon">
                  <group.icon className="h-3.5 w-3.5" />
                </span>
                {!collapsed && (
                  <span className="flex-1 truncate">{group.label}</span>
                )}
                {!collapsed && (
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                  />
                )}
              </button>
              {isOpen && (
                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.items.map((item) => {
                      const locked = "locked" in item && (item as { locked?: boolean }).locked;
                      if (locked) {
                        return (
                          <SidebarMenuItem key={item.title}>
                            <SidebarMenuButton
                              tooltip="WhatsApp bloqueado até a configuração completa"
                              disabled
                              className="opacity-100"
                            >
                              <item.icon className="h-4 w-4" />
                              {!collapsed && (
                                <span className="flex items-center gap-2">
                                  {item.title}
                                  <Lock className="h-3 w-3" />
                                </span>
                              )}
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        );
                      }
                      return (
                        <SidebarMenuItem key={item.title}>
                          <SidebarMenuButton asChild tooltip={item.title}>
                            <NavLink
                              to={item.url}
                              end={item.url === "/"}
                              className="group/nav relative rounded-md transition-all hover:bg-sidebar-accent/60"
                              activeClassName="bg-sidebar-primary/15 text-sidebar-primary font-semibold ring-1 ring-sidebar-primary/25 before:absolute before:left-0 before:top-1/2 before:h-5 before:w-0.5 before:-translate-y-1/2 before:rounded-r-full before:bg-sidebar-primary"
                            >
                              <item.icon className="h-4 w-4 transition-transform group-hover/nav:scale-110" />
                              {!collapsed && <span className="truncate">{item.title}</span>}
                            </NavLink>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              )}
            </SidebarGroup>
          );
        })}
        {isSuperAdmin && vendasItems.length > 0 && (() => {
          const isOpen = collapsed || openGroup === "vendas";
          return (
            <SidebarGroup
              className="sidebar-group-card"
              data-collapsed={collapsed ? "true" : "false"}
            >
              <button
                type="button"
                onClick={() => !collapsed && toggleGroup("vendas")}
                className="sidebar-group-header w-full text-left"
                aria-expanded={isOpen}
              >
                <span className="sidebar-group-header-icon">
                  <Sparkles className="h-3.5 w-3.5" />
                </span>
                {!collapsed && <span className="flex-1 truncate">Vendas (Owner)</span>}
                {!collapsed && (
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                  />
                )}
              </button>
              {isOpen && (
                <SidebarGroupContent>
                  <SidebarMenu>
                    {vendasItems.map((it) => (
                      <SidebarMenuItem key={it.to}>
                        <SidebarMenuButton asChild tooltip={it.tooltip}>
                          <NavLink
                            to={it.to}
                            className="group/nav relative rounded-md transition-all hover:bg-sidebar-accent/60"
                            activeClassName="bg-sidebar-primary/15 text-sidebar-primary font-semibold ring-1 ring-sidebar-primary/25 before:absolute before:left-0 before:top-1/2 before:h-5 before:w-0.5 before:-translate-y-1/2 before:rounded-r-full before:bg-sidebar-primary"
                          >
                            <it.icon className="h-4 w-4 transition-transform group-hover/nav:scale-110" />
                            {!collapsed && <span className="truncate">{it.title}</span>}
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              )}
            </SidebarGroup>
          );
        })()}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        {!collapsed && user && (
          <div className="px-2 py-1">
            <p className="text-xs text-sidebar-foreground/70 truncate">{user.email}</p>
          </div>
        )}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Sair" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              {!collapsed && <span>Sair</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
