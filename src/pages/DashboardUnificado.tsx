import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCidades, useLiderancas, useProjecoes } from "@/hooks/useSupabaseData";
import { useDobradinhas } from "@/hooks/useDobradinhas";
import { useCabosEleitorais } from "@/hooks/useCabosEleitorais";
import { useAppSettings } from "@/hooks/useAppSettings";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Target, TrendingUp, Users, Building2, Handshake, Package, DollarSign,
  AlertTriangle, MapPin, Loader2, ArrowUpRight, Vote, BarChart3, Trophy,
  Sparkles, LucideIcon, Activity
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, RadialBarChart, RadialBar, PolarAngleAxis
} from "recharts";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

const PIE_COLORS = [
  'hsl(215, 70%, 50%)', 'hsl(142, 60%, 42%)', 'hsl(38, 92%, 50%)',
  'hsl(340, 75%, 55%)', 'hsl(280, 60%, 55%)', 'hsl(180, 60%, 40%)',
];

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border/60 bg-card/95 backdrop-blur px-3.5 py-2.5 shadow-xl">
      {label && <p className="text-xs font-semibold text-card-foreground mb-1.5">{label}</p>}
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <span className="h-2 w-2 rounded-full" style={{ background: entry.color || entry.payload?.fill }} />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-semibold tabular-nums" style={{ color: entry.color || entry.payload?.fill }}>
            {Number(entry.value).toLocaleString('pt-BR')}
          </span>
        </div>
      ))}
    </div>
  );
};

function MiniStat({
  title, value, subtitle, icon: Icon, accent = "blue",
}: {
  title: string; value: number | string; subtitle?: string; icon: LucideIcon;
  accent?: "blue" | "green" | "orange" | "violet" | "slate" | "rose";
}) {
  const accents: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-emerald-50 text-emerald-600",
    orange: "bg-orange-50 text-orange-600",
    violet: "bg-violet-50 text-violet-600",
    slate: "bg-slate-100 text-slate-600",
    rose: "bg-rose-50 text-rose-600",
  };
  return (
    <Card className="group border-border/60 bg-card rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className={cn("flex h-9 w-9 items-center justify-center rounded-xl", accents[accent])}>
            <Icon className="h-[18px] w-[18px]" strokeWidth={2.2} />
          </div>
        </div>
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{title}</p>
        <p className="mt-1 text-2xl font-bold tracking-tight tabular-nums">
          {typeof value === "number" ? value.toLocaleString("pt-BR") : value}
        </p>
        {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

function EmptyState({ msg }: { msg: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center mb-2">
        <BarChart3 className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-sm text-muted-foreground max-w-[200px]">{msg}</p>
    </div>
  );
}

function QuickLink({ to, label, icon: Icon }: { to: string; label: string; icon: LucideIcon }) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-3 rounded-2xl border border-border/60 bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-primary/30"
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
        <Icon className="h-4 w-4" strokeWidth={2.2} />
      </div>
      <span className="text-sm font-semibold text-foreground">{label}</span>
      <ArrowUpRight className="h-4 w-4 ml-auto text-muted-foreground transition-all group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
    </Link>
  );
}

export default function DashboardUnificado() {
  // Electoral data
  const { data: cidades = [], isLoading: lc } = useCidades();
  const { data: liderancas = [], isLoading: ll } = useLiderancas();
  const { data: projecoes = [], isLoading: lp } = useProjecoes();
  const { data: dobradinhas = [], isLoading: ld } = useDobradinhas();
  const { data: cabos = [] } = useCabosEleitorais();
  const { data: appSettings, isLoading: ls } = useAppSettings();
  const { userRole } = useAuth();
  const isAdminView = userRole === "admin";

  // Logistics data
  const { data: logData, isLoading: logLoading } = useQuery({
    queryKey: ["unified-dashboard-log"],
    queryFn: async () => {
      const [profilesRes, materialsRes, movementsRes, financialRes] = await Promise.all([
        supabase.from("logistics_profiles").select("*"),
        supabase.from("materials").select("*"),
        supabase.from("movements").select("*, materials(name), logistics_profiles(full_name)").order("created_at", { ascending: false }).limit(5),
        supabase.from("financial_transactions").select("*"),
      ]);
      return {
        profiles: (profilesRes.data || []) as any[],
        materials: (materialsRes.data || []) as any[],
        movements: (movementsRes.data || []) as any[],
        financial: (financialRes.data || []) as any[],
      };
    },
  });

  const { data: captadosCount = 0 } = useQuery({
    queryKey: ["captados-total-coordenacao", isAdminView],
    queryFn: async () => {
      // RPC retorna total global para admin e total da coordenação (próprias + equipe + lideranças vinculadas) para coordenadores
      const { data, error } = await supabase.rpc("get_captados_total_coordenacao" as never);
      if (error) return 0;
      return Number(data) || 0;
    },
  });

  const profiles = logData?.profiles || [];
  const materials = logData?.materials || [];
  const movements = logData?.movements || [];
  const financial = logData?.financial || [];

  // Electoral computed
  const cabosVotosByLider = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of cabos as any[]) {
      if (!c.lider_id) continue;
      m.set(c.lider_id, (m.get(c.lider_id) || 0) + (c.votos_estimados || 0));
    }
    return m;
  }, [cabos]);

  const liderancaVotosTotal = useMemo(() =>
    liderancas.reduce((a, l) => a + ((l as any).votos_estimados || 0) + (cabosVotosByLider.get(l.id) || 0), 0),
    [liderancas, cabosVotosByLider]
  );

  const metaGeral = useMemo(() => {
    // Admin vê meta global da campanha (ex.: 120.000).
    // Coordenadores veem como meta a soma dos votos projetados da própria equipe.
    if (!isAdminView) return liderancaVotosTotal;
    const fromSettings = Number(appSettings?.meta_geral_votos || 0);
    if (fromSettings > 0) return fromSettings;
    return projecoes.reduce((a, p) => a + (p.meta_votos || 0), 0);
  }, [appSettings, projecoes, isAdminView, liderancaVotosTotal]);

  const votosConfirmados = useMemo(() =>
    projecoes.reduce((a, p) => a + (p.votos_confirmados || 0), 0),
    [projecoes]
  );

  // Para coordenadores: meta atingida = captações da equipe (vs meta projetada das lideranças).
  // Para admin: mantém comportamento original (projeção acumulada vs meta global).
  const atingido = isAdminView ? liderancaVotosTotal : captadosCount;
  const percentualMeta = metaGeral > 0 ? Math.round((atingido / metaGeral) * 100) : 0;

  const liderancaMap = useMemo(() => new Map(liderancas.map(l => [l.id, l])), [liderancas]);

  const dobStats = useMemo(() => {
    let totalVotos = 0;
    dobradinhas.forEach(d => {
      const lid = d.lideranca_id ? liderancaMap.get(d.lideranca_id) : null;
      const lidVotos = lid ? ((lid as any).votos_estimados || 0) : 0;
      totalVotos += lidVotos > 0 ? lidVotos : (d.votos_estimados || 0);
    });
    return { totalVotos, total: dobradinhas.length };
  }, [dobradinhas, liderancaMap]);

  // Logistics computed
  const totalInvestment = useMemo(() => materials.reduce((s: number, m: any) => s + (m.total_price || 0), 0), [materials]);
  const lowStockItems = useMemo(() => materials.filter((m: any) => m.total_qty > 0 && m.available_qty / m.total_qty < 0.15), [materials]);
  const financialBalance = useMemo(() => {
    const receitas = financial.filter((f: any) => f.type === 'Receita').reduce((s: number, f: any) => s + (f.amount || 0), 0);
    const despesas = financial.filter((f: any) => f.type === 'Despesa').reduce((s: number, f: any) => s + (f.amount || 0), 0);
    return receitas - despesas;
  }, [financial]);

  // Chart: top cities by votes
  const cidadeMap = useMemo(() => new Map(cidades.map(c => [c.id, c])), [cidades]);
  const topCidades = useMemo(() => {
    const map: Record<string, number> = {};
    liderancas.forEach(l => {
      if (l.cidade_base_id) map[l.cidade_base_id] = (map[l.cidade_base_id] || 0) + ((l as any).votos_estimados || 0) + (cabosVotosByLider.get(l.id) || 0);
    });
    return Object.entries(map)
      .map(([cid, votos]) => ({ nome: cidadeMap.get(cid)?.nome || '', votos }))
      .filter(c => c.nome && c.votos > 0)
      .sort((a, b) => b.votos - a.votos)
      .slice(0, 8);
  }, [liderancas, cidadeMap]);

  // Chart: materials by type
  const materialsByType = useMemo(() => {
    const map = new Map<string, number>();
    materials.forEach((m: any) => map.set(m.type, (map.get(m.type) || 0) + (m.total_qty || 0)));
    return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [materials]);

  // Alertas unificados — apenas cidades sem liderança E sem projeção/votos estimados
  const alertas = useMemo(() => {
    const list: { msg: string; type: 'warning' | 'danger'; area: string }[] = [];
    const cidadesComLideranca = new Set<string>();
    liderancas.forEach(l => {
      if (l.cidade_base_id) cidadesComLideranca.add(l.cidade_base_id);
      ((l as any).cidades_representadas || []).forEach((id: string) => cidadesComLideranca.add(id));
    });
    cidades
      .filter(c => {
        if (cidadesComLideranca.has(c.id)) return false;
        const proj = projecoes.find(p => p.cidade_id === c.id);
        const votos = (proj as any)?.votos_projetados || 0;
        return !proj || votos === 0;
      })
      .slice(0, 3)
      .forEach(c => list.push({ msg: `${c.nome} sem liderança e sem votos`, type: 'warning', area: 'Eleitoral' }));
    lowStockItems
      .slice(0, 3)
      .forEach((m: any) => list.push({ msg: `${m.name} — ${m.available_qty} un. restantes`, type: 'danger', area: 'Logística' }));
    return list;
  }, [cidades, projecoes, liderancas, lowStockItems]);

  const isLoading = lc || ll || lp || ld || ls || logLoading;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Carregando painel unificado...</p>
      </div>
    );
  }

  const radialData = [{
    name: "Meta",
    value: Math.min(percentualMeta, 100),
    fill: percentualMeta >= 100 ? "hsl(142, 72%, 38%)" : percentualMeta >= 60 ? "hsl(215, 80%, 55%)" : "hsl(38, 92%, 50%)",
  }];

  return (
    <div className="min-h-screen bg-[hsl(210_25%_98%)]">
      <div className="mx-auto max-w-[1400px] space-y-6 p-4 md:p-6 lg:p-8">
        {/* Header */}
        <header className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
              Visão integrada
            </p>
            <h1 className="mt-1 text-[28px] md:text-[32px] font-bold tracking-tight text-foreground">
              Painel Unificado
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Campanha eleitoral &amp; logística em uma única tela estratégica
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card px-3 py-1.5">
              <Building2 className="h-3.5 w-3.5 text-primary" /> {cidades.length.toLocaleString("pt-BR")} cidades
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card px-3 py-1.5">
              <Users className="h-3.5 w-3.5 text-primary" /> {liderancas.length.toLocaleString("pt-BR")} lideranças
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card px-3 py-1.5">
              <Package className="h-3.5 w-3.5 text-primary" /> {materials.length.toLocaleString("pt-BR")} materiais
            </span>
          </div>
        </header>

        {/* Hero row — Meta + Captados */}
        <section className="grid gap-5 lg:grid-cols-3">
          {/* Meta Geral */}
          <Card className="lg:col-span-2 relative overflow-hidden rounded-2xl border-0 bg-gradient-to-br from-[hsl(215_70%_22%)] via-[hsl(215_70%_28%)] to-[hsl(210_90%_35%)] text-white shadow-xl">
            <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/5 blur-3xl" />
            <div className="absolute -bottom-20 -left-10 h-64 w-64 rounded-full bg-white/5 blur-3xl" />
            <CardContent className="relative p-6 md:p-7">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
                    <Target className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70">
                      Meta geral de votos
                    </p>
                    <p className="text-sm text-white/80">{isAdminView ? "Projeção acumulada das lideranças" : "Captações da sua equipe vs meta projetada"}</p>
                  </div>
                </div>
                <Badge className="bg-white/15 text-white border-0 backdrop-blur hover:bg-white/20">
                  {percentualMeta}% atingido
                </Badge>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-[1fr_auto] items-end">
                <div>
                  <p className="text-5xl md:text-[56px] font-bold tracking-tight tabular-nums leading-none">
                    {atingido.toLocaleString("pt-BR")}
                  </p>
                  <p className="mt-2 text-sm text-white/70">
                    de <span className="font-semibold text-white">{metaGeral.toLocaleString("pt-BR")}</span> {isAdminView ? "votos planejados" : "votos projetados pela equipe"}
                  </p>
                  <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-white/15">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-white via-white to-white/90 transition-all duration-700"
                      style={{ width: `${Math.min(percentualMeta, 100)}%` }}
                    />
                  </div>
                </div>
                <div className="h-[120px] w-[120px] shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadialBarChart innerRadius="70%" outerRadius="100%" data={radialData} startAngle={90} endAngle={-270}>
                      <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                      <RadialBar background={{ fill: "rgba(255,255,255,0.15)" }} dataKey="value" cornerRadius={20} fill="#ffffff" />
                    </RadialBarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Captados */}
          <Card className="relative overflow-hidden rounded-2xl border-border/60 bg-card shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                    <Vote className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Apoiadores Captados
                    </p>
                    <p className="text-xs text-muted-foreground">QR / Cadastros únicos</p>
                  </div>
                </div>
              </div>
              <p className="mt-6 text-5xl font-bold tracking-tight tabular-nums">
                {captadosCount.toLocaleString("pt-BR")}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {votosConfirmados.toLocaleString("pt-BR")} confirmados nas projeções
              </p>
              <div className="mt-5 grid grid-cols-2 gap-3 border-t border-border/60 pt-4">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Dobradinhas</p>
                  <p className="text-lg font-bold tabular-nums">{dobStats.total}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Votos das parcerias</p>
                  <p className="text-lg font-bold tabular-nums">{dobStats.totalVotos.toLocaleString("pt-BR")}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Secondary KPIs */}
        <section className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          <MiniStat title="Cidades" value={cidades.length} subtitle="cobertura mapeada" icon={Building2} accent="blue" />
          <MiniStat title="Lideranças" value={liderancas.length} subtitle="cadastradas no sistema" icon={Users} accent="violet" />
          <MiniStat title="Dobradinhas" value={dobStats.total} subtitle="parcerias ativas" icon={Handshake} accent="orange" />
          <MiniStat title="Materiais" value={materials.length} subtitle={`${lowStockItems.length} c/ estoque baixo`} icon={Package} accent="slate" />
          <MiniStat title="Equipe logística" value={profiles.length} subtitle="pessoas cadastradas" icon={Users} accent="rose" />
          <MiniStat
            title="Saldo financeiro"
            value={`R$ ${(financialBalance / 1000).toFixed(1)}k`}
            subtitle={`R$ ${(totalInvestment / 1000).toFixed(0)}k investidos`}
            icon={DollarSign}
            accent={financialBalance >= 0 ? "green" : "rose"}
          />
        </section>

        {/* Alertas */}
        {alertas.length > 0 && (
          <Card className="rounded-2xl border-amber-200/70 bg-gradient-to-br from-amber-50 to-orange-50/30 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-bold text-amber-900">Alertas estratégicos</p>
                  <p className="text-[11px] text-amber-700/80">{alertas.length} ponto{alertas.length === 1 ? "" : "s"} de atenção</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {alertas.map((a, i) => (
                  <span
                    key={i}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium",
                      a.type === "danger"
                        ? "border-red-200 bg-white text-red-700"
                        : "border-amber-200 bg-white text-amber-800",
                    )}
                  >
                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-60">[{a.area}]</span>
                    {a.msg}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabbed analytics */}
        <Tabs defaultValue="eleitoral" className="w-full">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold tracking-tight">Análises detalhadas</h2>
            <TabsList className="bg-card border border-border/60 shadow-sm">
              <TabsTrigger value="eleitoral" className="gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <BarChart3 className="h-3.5 w-3.5" /> Eleitoral
              </TabsTrigger>
              <TabsTrigger value="logistica" className="gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <Package className="h-3.5 w-3.5" /> Logística
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="eleitoral" className="mt-0">
            <div className="grid gap-5 lg:grid-cols-5">
              <Card className="lg:col-span-3 rounded-2xl border-border/60 bg-card shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                        <MapPin className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-bold">Top cidades por votos estimados</p>
                        <p className="text-xs text-muted-foreground">Soma das estimativas das lideranças locais</p>
                      </div>
                    </div>
                  </div>
                  {topCidades.length > 0 ? (
                    <ResponsiveContainer width="100%" height={320}>
                      <BarChart data={topCidades} layout="vertical" margin={{ left: 5, right: 24, top: 4, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                        <YAxis type="category" dataKey="nome" tick={{ fontSize: 11, fill: 'hsl(var(--foreground))' }} width={90} axisLine={false} tickLine={false} />
                        <Tooltip content={<ChartTooltip />} cursor={{ fill: "hsl(var(--accent))", opacity: 0.4 }} />
                        <Bar dataKey="votos" fill="hsl(215, 80%, 55%)" radius={[0, 8, 8, 0]} name="Votos estimados" barSize={18} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <EmptyState msg="Cadastre lideranças com votos estimados" />}
                </CardContent>
              </Card>

              <Card className="lg:col-span-2 rounded-2xl border-border/60 bg-card shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                        <Trophy className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-bold">Top lideranças</p>
                        <p className="text-xs text-muted-foreground">Ranking por votos estimados</p>
                      </div>
                    </div>
                    <Link to="/liderancas" className="text-xs font-medium text-primary inline-flex items-center gap-1 hover:underline">
                      Ver todas <ArrowUpRight className="w-3 h-3" />
                    </Link>
                  </div>
                  <div className="space-y-2">
                    {liderancas
                      .filter(l => l.status === 'ativa')
                      .sort((a, b) => ((b as any).votos_estimados || 0) - ((a as any).votos_estimados || 0))
                      .slice(0, 5)
                      .map((l, i) => {
                        const medalBg = ["bg-amber-100 text-amber-700", "bg-slate-100 text-slate-600", "bg-orange-100 text-orange-700"];
                        return (
                          <div key={l.id} className="flex items-center justify-between rounded-xl border border-border/50 bg-background/40 px-3 py-2.5 transition-colors hover:bg-accent/40">
                            <div className="flex items-center gap-3 min-w-0">
                              <span className={cn(
                                "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold",
                                medalBg[i] || "bg-muted text-muted-foreground"
                              )}>
                                {i + 1}
                              </span>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold leading-tight truncate">{l.nome}</p>
                                <p className="text-[11px] text-muted-foreground truncate">{cidadeMap.get(l.cidade_base_id || '')?.nome || "—"}</p>
                              </div>
                            </div>
                            <div className="text-right shrink-0 ml-2">
                              <p className="text-sm font-bold tabular-nums">{((l as any).votos_estimados || 0).toLocaleString('pt-BR')}</p>
                              <Badge variant={l.forca_politica === 'alta' ? 'default' : 'secondary'} className="text-[9px] px-1.5 py-0 mt-0.5">
                                {l.forca_politica}
                              </Badge>
                            </div>
                          </div>
                        );
                      })}
                    {liderancas.filter(l => l.status === 'ativa').length === 0 && <EmptyState msg="Cadastre lideranças ativas" />}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="logistica" className="mt-0">
            <div className="grid gap-5 lg:grid-cols-5">
              <Card className="lg:col-span-2 rounded-2xl border-border/60 bg-card shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-50 text-orange-600">
                      <Package className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-bold">Materiais por tipo</p>
                      <p className="text-xs text-muted-foreground">Distribuição do inventário</p>
                    </div>
                  </div>
                  {materialsByType.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie data={materialsByType} cx="50%" cy="50%" innerRadius={55} outerRadius={105} paddingAngle={3} dataKey="value" nameKey="name" stroke="hsl(var(--background))" strokeWidth={2}
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                          {materialsByType.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <Tooltip content={<ChartTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : <EmptyState msg="Cadastre materiais para visualizar" />}
                </CardContent>
              </Card>

              <Card className="lg:col-span-3 rounded-2xl border-border/60 bg-card shadow-sm">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                        <Activity className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-bold">Últimas movimentações</p>
                        <p className="text-xs text-muted-foreground">Entradas, saídas e ajustes recentes</p>
                      </div>
                    </div>
                    <Link to="/log-distribuicao" className="text-xs font-medium text-primary inline-flex items-center gap-1 hover:underline">
                      Ver todas <ArrowUpRight className="w-3 h-3" />
                    </Link>
                  </div>
                  {movements.length > 0 ? (
                    <div className="space-y-2">
                      {movements.map((mov: any) => (
                        <div key={mov.id} className="flex items-start gap-3 rounded-xl border border-border/50 bg-background/40 px-3 py-2.5 hover:bg-accent/40 transition-colors">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-foreground">{mov.materials?.name || "-"}</span>
                              <span className={cn(
                                "text-[10px] px-2 py-0.5 rounded-full font-semibold",
                                mov.type === "Entrada" && "bg-emerald-50 text-emerald-700",
                                mov.type === "Saída" && "bg-red-50 text-red-700",
                                mov.type !== "Entrada" && mov.type !== "Saída" && "bg-muted text-muted-foreground",
                              )}>{mov.type}</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {mov.quantity?.toLocaleString("pt-BR")} un. • {mov.logistics_profiles?.full_name || "-"}
                            </p>
                            <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                              {mov.city && <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" />{mov.city}</span>}
                              <span>{new Date(mov.created_at).toLocaleDateString("pt-BR")}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : <EmptyState msg="Nenhuma movimentação registrada" />}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Quick links */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Acessos rápidos</h2>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <QuickLink to="/dashboard-eleitoral" label="Dashboard Eleitoral" icon={BarChart3} />
            <QuickLink to="/log-dashboard" label="Painel Logístico" icon={Package} />
            <QuickLink to="/mapa" label="Mapa Eleitoral" icon={MapPin} />
            <QuickLink to="/log-financeiro" label="Financeiro" icon={DollarSign} />
          </div>
        </section>
      </div>
    </div>
  );
}
