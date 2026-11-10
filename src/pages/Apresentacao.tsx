import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ChevronLeft, ChevronRight, Play, X, LayoutDashboard, Map, Building2,
  Users, BarChart3, Vote, Tent, Calendar, MapPin, Navigation, Package,
  Warehouse, Truck, DollarSign, Shield, ClipboardList, Radar, Brain,
  PhoneCall, Contact, FileText, UserCog, Archive, Settings, KeyRound,
  Monitor, Info,
} from "lucide-react";

interface Slide {
  id: string;
  title: string;
  icon: any;
  category: string;
  description: string;
  bullets: string[];
  route?: string;
}

const SLIDES: Slide[] = [
  { id: "painel", title: "Painel Unificado", icon: LayoutDashboard, category: "Principal", route: "/",
    description: "Visão geral de toda a campanha em uma única tela.",
    bullets: ["Indicadores estratégicos em tempo real", "Alertas de cidades sem planejamento", "Ranking social, logístico e eleitoral"] },
  { id: "dashboard", title: "Dashboard Eleitoral", icon: BarChart3, category: "Principal", route: "/dashboard-eleitoral",
    description: "Métricas eleitorais detalhadas.",
    bullets: ["Meta vs projeção de votos", "Evolução por cidade", "Comparativos históricos TSE"] },
  { id: "mapa", title: "Mapa Eleitoral", icon: Map, category: "Principal", route: "/mapa",
    description: "Visualização geográfica de toda atuação.",
    bullets: ["645 municípios de SP", "Cores por coordenador / dobradinha", "Camadas: lideranças, votos, prioridade"] },
  { id: "cidades", title: "Cidades", icon: Building2, category: "Cadastros", route: "/cidades",
    description: "Gestão completa por município.",
    bullets: ["Metas de votos por cidade", "Coordenação responsável", "Histórico TSE integrado"] },
  { id: "liderancas", title: "Lideranças", icon: Users, category: "Cadastros", route: "/liderancas",
    description: "Cadastro central da rede de apoio.",
    bullets: ["Vínculo com cidades e bairros", "Estimativa de votos por liderança", "Atalho para dobradinhas"] },
  { id: "dobradinhas", title: "Dobradinhas", icon: Vote, category: "Cadastros", route: "/dobradinhas",
    description: "Candidaturas conjuntas e parcerias.",
    bullets: ["Cadastro flexível por parceiro", "Vínculo automático com cidades", "Cor própria no mapa"] },
  { id: "projecoes", title: "Projeção de Votos", icon: BarChart3, category: "Cadastros", route: "/projecoes",
    description: "Consolidação das estimativas.",
    bullets: ["Soma das estimativas dos líderes", "Comparação com meta geral", "Exportação em PDF/Excel"] },
  { id: "votos", title: "Votos & Apuração", icon: Vote, category: "Cadastros", route: "/projecoes",
    description: "Acompanhamento de votos por cidade e liderança.",
    bullets: ["Meta x projetado x apurado", "Detalhamento por liderança", "Visualização no mapa eleitoral"] },
  { id: "captados", title: "Apoiadores Captados", icon: Vote, category: "Operação", route: "/eleitores-captados",
    description: "Apoiadores efetivamente registrados.",
    bullets: ["Captação via QR code em campo", "Link público por captador", "Acompanhamento por liderança"] },
  { id: "estrutura", title: "Estrutura", icon: Tent, category: "Operação", route: "/estrutura",
    description: "Pontos físicos e estruturas operacionais.",
    bullets: ["Comitês, bandeiraços, eventos", "Vinculação com cidades", "Status de cada estrutura"] },
  { id: "agenda", title: "Agenda", icon: Calendar, category: "Operação", route: "/agenda",
    description: "Compromissos do candidato e equipe.",
    bullets: ["Aprovação por coordenação", "Vínculo com cidades e lideranças", "Notificações automáticas"] },
  { id: "visitas", title: "Visitas", icon: MapPin, category: "Operação", route: "/visitas",
    description: "Registro de visitas em campo.",
    bullets: ["Endereço completo obrigatório", "Foto e observações", "Geolocalização integrada"] },
  { id: "rastreamento", title: "Rastreamento de Equipe", icon: Navigation, category: "Operação", route: "/rastreamento",
    description: "Localização em tempo real da equipe.",
    bullets: ["Consentimento LGPD obrigatório", "Atualização a cada 15 min", "Mapa exclusivo do administrador"] },
  { id: "log-dashboard", title: "Painel Logístico", icon: LayoutDashboard, category: "Logística", route: "/log-dashboard",
    description: "Visão geral da operação logística.",
    bullets: ["Estoque, distribuição e custos", "Movimentações em tempo real", "Alertas operacionais"] },
  { id: "log-materiais", title: "Materiais", icon: Package, category: "Logística", route: "/log-materiais",
    description: "Cadastro de materiais de campanha.",
    bullets: ["Santinhos, adesivos, brindes", "Custo unitário e fornecedor", "Categorias e fotos"] },
  { id: "log-estoque", title: "Estoque", icon: Warehouse, category: "Logística", route: "/log-estoque",
    description: "Controle automático de quantidades.",
    bullets: ["Disponível x distribuído", "Trigger automático por movimentação", "Alertas de ruptura"] },
  { id: "log-distribuicao", title: "Distribuição", icon: Truck, category: "Logística", route: "/log-distribuicao",
    description: "Movimentações com responsáveis.",
    bullets: ["Liderança e coordenador vinculados", "Histórico completo", "Comprovantes anexos"] },
  { id: "log-financeiro", title: "Financeiro", icon: DollarSign, category: "Logística", route: "/log-financeiro",
    description: "Controle de custos da campanha.",
    bullets: ["Acesso restrito (Super Admin)", "Despesas por categoria", "Relatórios consolidados"] },
  { id: "log-auditoria", title: "Auditoria", icon: Shield, category: "Logística", route: "/log-auditoria",
    description: "Trilha completa de ações.",
    bullets: ["Quem fez o quê e quando", "Filtros por usuário/módulo", "Exportação para conformidade"] },
  { id: "log-relatorios", title: "Relatórios Logísticos", icon: ClipboardList, category: "Logística", route: "/log-relatorios",
    description: "Exportação operacional.",
    bullets: ["PDF, Excel e CSV (UTF-8 BOM)", "Filtros avançados", "Agrupamento por cidade/coordenador"] },
  { id: "radar", title: "Radar Social", icon: Radar, category: "Redes Sociais", route: "/radar-social",
    description: "Monitoramento do Instagram e Facebook.",
    bullets: ["Insights de posts e seguidores", "Menções e comentários", "Coleta automática a cada 6h"] },
  { id: "inteligencia", title: "Inteligência de Campanha", icon: Brain, category: "Redes Sociais", route: "/inteligencia",
    description: "Notícias e tendências relevantes.",
    bullets: ["9 temas estratégicos", "Google News e Trends integrados", "Resumos por IA"] },
  { id: "contato-coord", title: "Contato Coordenação", icon: PhoneCall, category: "Administração", route: "/contato-coordenacao",
    description: "Canal direto com coordenadores.",
    bullets: ["Mensagens centralizadas", "Histórico por coordenador", "Notificações de novas tratativas"] },
  { id: "leads", title: "Leads & Contatos", icon: Contact, category: "Administração", route: "/leads",
    description: "Pipeline de novos apoiadores.",
    bullets: ["WhatsApp com mensagem automática", "Origem identificada (líder/captador)", "Conversão em apoiador"] },
  { id: "relatorios", title: "Relatórios", icon: FileText, category: "Administração", route: "/relatorios",
    description: "Relatórios gerais da campanha.",
    bullets: ["PDF, Excel e CSV", "Liderança sem telefone (privacidade)", "Filtros por período e cidade"] },
  { id: "usuarios", title: "Usuários", icon: UserCog, category: "Administração", route: "/usuarios",
    description: "Gestão de equipe e permissões.",
    bullets: ["Admin, Operador, Analista, Coordenador", "Cores únicas automáticas", "RLS regional por coordenador"] },
  { id: "arquivo", title: "Arquivo", icon: Archive, category: "Administração", route: "/arquivo",
    description: "Histórico de ciclos eleitorais.",
    bullets: ["Snapshots JSONB", "Comparação entre ciclos", "Restauração controlada"] },
  { id: "config", title: "Configurações", icon: Settings, category: "Administração", route: "/configuracoes",
    description: "Personalização do sistema.",
    bullets: ["White-label (logo, cor, nome)", "Chaves de API por cliente", "Reset controlado por digitação"] },
  { id: "vendas", title: "Licenças & Vendas", icon: KeyRound, category: "Owner", route: "/admin-vendas",
    description: "Gestão de licenças (exclusivo do owner).",
    bullets: ["Geração de chaves", "Histórico de vendas", "Bloqueio por RLS no banco"] },
];

const STORAGE_KEY = "apresentacao-selecao";

export default function Apresentacao() {
  const { isSuperAdmin, loading } = useAuth();
  const [selected, setSelected] = useState<Set<string>>(new Set(SLIDES.map(s => s.id)));
  const [presenting, setPresenting] = useState(false);
  const [current, setCurrent] = useState(0);
  const [liveMode, setLiveMode] = useState(true);
  const [showOverlay, setShowOverlay] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try { setSelected(new Set(JSON.parse(saved))); } catch {}
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...selected]));
  }, [selected]);

  const activeSlides = useMemo(() => SLIDES.filter(s => selected.has(s.id)), [selected]);

  const startPresentation = async () => {
    if (activeSlides.length === 0) return;
    setCurrent(0);
    setShowOverlay(true);
    setPresenting(true);
    try { await document.documentElement.requestFullscreen(); } catch {}
  };

  const exitPresentation = () => {
    setPresenting(false);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  };

  useEffect(() => {
    if (!presenting) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      // when interacting with iframe content, arrows still work because focus is outside
      if (e.key === "ArrowRight" || e.key === "PageDown") {
        setCurrent(c => Math.min(c + 1, activeSlides.length - 1));
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        setCurrent(c => Math.max(c - 1, 0));
      } else if (e.key === "Escape") {
        exitPresentation();
      } else if (e.key.toLowerCase() === "i") {
        setShowOverlay(o => !o);
      } else if (e.key.toLowerCase() === "d") {
        setLiveMode(m => !m);
      }
    };
    const onFs = () => { if (!document.fullscreenElement) setPresenting(false); };
    window.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFs);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFs);
    };
  }, [presenting, activeSlides.length]);

  if (loading) return null;
  if (!isSuperAdmin) return <Navigate to="/" replace />;

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const byCategory = SLIDES.reduce<Record<string, Slide[]>>((acc, s) => {
    (acc[s.category] ||= []).push(s); return acc;
  }, {});

  if (presenting && activeSlides[current]) {
    const slide = activeSlides[current];
    const Icon = slide.icon;
    const canLive = !!slide.route;
    const showLive = liveMode && canLive;

    return (
      <div className="fixed inset-0 z-[9999] bg-background flex flex-col">
        {/* Top control bar */}
        <div className="absolute top-3 right-3 flex items-center gap-2 z-20 bg-card/90 backdrop-blur border rounded-full px-3 py-1.5 shadow-lg">
          <span className="text-xs text-muted-foreground font-medium">{current + 1} / {activeSlides.length}</span>
          <span className="w-px h-4 bg-border" />
          <Button size="sm" variant={showLive ? "default" : "ghost"} className="h-7 px-2"
            onClick={() => setLiveMode(m => !m)} disabled={!canLive}
            title="Alternar modo demo (D)">
            <Monitor className="h-3.5 w-3.5 mr-1" /> Demo
          </Button>
          <Button size="sm" variant={showOverlay ? "default" : "ghost"} className="h-7 px-2"
            onClick={() => setShowOverlay(o => !o)}
            title="Mostrar/ocultar título (I)">
            <Info className="h-3.5 w-3.5 mr-1" /> Título
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={exitPresentation}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        {showLive ? (
          <div className="flex-1 relative bg-background">
            <iframe
              key={slide.id}
              src={`${slide.route}${slide.route?.includes("?") ? "&" : "?"}embed=1`}
              title={slide.title}
              className="w-full h-full border-0"
            />
            {showOverlay && (
              <div className="absolute top-3 left-3 z-10 bg-card/90 backdrop-blur border rounded-xl px-4 py-3 shadow-lg max-w-md animate-fade-in">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-primary font-semibold">{slide.category}</p>
                    <h2 className="text-lg font-bold leading-tight">{slide.title}</h2>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mt-2">{slide.description}</p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center px-12 bg-gradient-to-br from-background via-background to-primary/10">
            <div className="max-w-5xl w-full animate-fade-in">
              <div className="flex items-center gap-6 mb-8">
                <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                  <Icon className="h-12 w-12" />
                </div>
                <div>
                  <p className="text-sm uppercase tracking-widest text-primary font-semibold mb-2">{slide.category}</p>
                  <h1 className="text-6xl font-bold tracking-tight">{slide.title}</h1>
                </div>
              </div>
              <p className="text-2xl text-muted-foreground mb-10 leading-relaxed">{slide.description}</p>
              <ul className="space-y-5">
                {slide.bullets.map((b, i) => (
                  <li key={i} className="flex items-start gap-4 text-2xl">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">{i + 1}</span>
                    <span className="pt-1">{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Bottom nav */}
        <div className="flex items-center justify-between p-3 border-t bg-card/80 backdrop-blur">
          <Button variant="outline" size="sm" onClick={() => setCurrent(c => Math.max(c - 1, 0))} disabled={current === 0}>
            <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
          </Button>
          <div className="flex gap-1 overflow-x-auto max-w-[60%]">
            {activeSlides.map((_, i) => (
              <button key={i} onClick={() => setCurrent(i)}
                className={`h-2 rounded-full transition-all shrink-0 ${i === current ? "w-8 bg-primary" : "w-2 bg-muted-foreground/30"}`} />
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={() => setCurrent(c => Math.min(c + 1, activeSlides.length - 1))} disabled={current === activeSlides.length - 1}>
            Próximo <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-6xl mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold">Apresentação do Sistema</h1>
          <p className="text-muted-foreground mt-1">
            Selecione as abas que deseja apresentar em tela cheia. Disponível apenas para o gestor master.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setSelected(new Set(SLIDES.map(s => s.id)))}>Marcar todos</Button>
          <Button variant="outline" onClick={() => setSelected(new Set())}>Limpar</Button>
          <Button size="lg" onClick={startPresentation} disabled={activeSlides.length === 0}>
            <Play className="h-5 w-5 mr-2" /> Iniciar ({activeSlides.length})
          </Button>
        </div>
      </div>

      <Card className="p-4 bg-primary/5 border-primary/20">
        <div className="flex items-start gap-3">
          <Monitor className="h-5 w-5 text-primary mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold mb-1">Modo Demo ao vivo</p>
            <p className="text-muted-foreground">
              Cada slide abre a tela real do sistema dentro da apresentação — você navega, clica e demonstra de verdade.
              Use <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs">D</kbd> para alternar entre demo e resumo,
              <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs ml-1">I</kbd> para mostrar/ocultar o título,
              setas para navegar e <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs">Esc</kbd> para sair.
            </p>
          </div>
        </div>
      </Card>

      {Object.entries(byCategory).map(([cat, items]) => (
        <div key={cat}>
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">{cat}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {items.map(s => {
              const Icon = s.icon;
              const checked = selected.has(s.id);
              return (
                <Card key={s.id} onClick={() => toggle(s.id)}
                  className={`p-4 cursor-pointer transition-all hover:shadow-md ${checked ? "border-primary bg-primary/5" : ""}`}>
                  <div className="flex items-start gap-3">
                    <Checkbox checked={checked} onCheckedChange={() => toggle(s.id)} className="mt-1" />
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{s.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">{s.description}</p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
