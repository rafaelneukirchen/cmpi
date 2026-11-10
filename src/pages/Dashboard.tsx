import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useCidades, useLiderancas, useProjecoes } from "@/hooks/useSupabaseData";
import { useDobradinhas } from "@/hooks/useDobradinhas";
import { useCabosEleitorais } from "@/hooks/useCabosEleitorais";
import { useAppSettings } from "@/hooks/useAppSettings";
import { useAuth } from "@/hooks/useAuth";
import {
  BarChart3, Building2, Users, Target, TrendingUp, TrendingDown, Vote,
  AlertTriangle, Loader2, Handshake, MapPin, Award, ArrowUpRight, Activity,
  CheckCircle2, Crown, Trophy, Medal, Megaphone, LucideIcon
} from "lucide-react";
import {
  Area, AreaChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, RadialBarChart, RadialBar, PolarAngleAxis
} from "recharts";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type Period = "7" | "30" | "90" | "all";

const PERIOD_LABELS: Record<Period, string> = {
  "7": "7 dias",
  "30": "30 dias",
  "90": "90 dias",
  "all": "Todo período",
};

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border/60 bg-card/95 backdrop-blur px-3.5 py-2.5 shadow-xl">
      <p className="text-xs font-semibold text-card-foreground mb-1.5">{label}</p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <span className="h-2 w-2 rounded-full" style={{ background: entry.color }} />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-semibold tabular-nums" style={{ color: entry.color }}>
            {Number(entry.value).toLocaleString('pt-BR')}
          </span>
        </div>
      ))}
    </div>
  );
};

function GrowthBadge({ value }: { value: number | null }) {
  if (value === null || !isFinite(value)) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
        <Activity className="h-3 w-3" /> novo
      </span>
    );
  }
  const positive = value >= 0;
  const Icon = positive ? TrendingUp : TrendingDown;
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums",
      positive ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
    )}>
      <Icon className="h-3 w-3" />
      {positive ? "+" : ""}{value.toFixed(1)}%
    </span>
  );
}

function MiniStat({
  title, value, subtitle, icon: Icon, growth, accent = "blue",
}: {
  title: string; value: number | string; subtitle?: string; icon: LucideIcon;
  growth?: number | null; accent?: "blue" | "green" | "orange" | "violet" | "slate" | "rose";
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
            <Icon className="h-4.5 w-4.5" strokeWidth={2.2} />
          </div>
          {growth !== undefined && <GrowthBadge value={growth ?? null} />}
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

export default function Dashboard() {
  const { data: cidades = [], isLoading: lc } = useCidades();
  const { data: liderancas = [], isLoading: ll } = useLiderancas();
  const { data: projecoes = [], isLoading: lp } = useProjecoes();
  const { data: dobradinhas = [], isLoading: ld } = useDobradinhas();
  const { data: cabos = [] } = useCabosEleitorais();
  const { data: appSettings, isLoading: ls } = useAppSettings();
  const [period, setPeriod] = useState<Period>("30");
  const { userRole } = useAuth();
  const isAdminView = userRole === "admin";

  const { data: captadosTotal = 0 } = useQuery({
    queryKey: ["captados-total-coordenacao", isAdminView],
    queryFn: async () => {
      // RPC retorna total global para admin e total da coordenação (próprias + equipe + lideranças vinculadas) para coordenadores
      const { data, error } = await supabase.rpc("get_captados_total_coordenacao" as never);
      if (error) return 0;
      return Number(data) || 0;
    },
  });

  const cabosVotosByLider = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of cabos as any[]) {
      if (!c.lider_id) continue;
      m.set(c.lider_id, (m.get(c.lider_id) || 0) + (c.votos_estimados || 0));
    }
    return m;
  }, [cabos]);

  const cabosVotosTotal = useMemo(
    () => (cabos as any[]).reduce((a, c) => a + (c.votos_estimados || 0), 0),
    [cabos]
  );

  const liderancaVotosTotal = useMemo(() =>
    liderancas.reduce((a, l) => a + ((l as any).votos_estimados || 0) + (cabosVotosByLider.get(l.id) || 0), 0),
    [liderancas, cabosVotosByLider]
  );

  const metaGeral = useMemo(() => {
    // Coordenadores: a meta exibida é a soma dos votos projetados pelas lideranças
    // que eles coordenam (escopo já filtrado por RLS). Admin: meta global da campanha.
    if (!isAdminView) return liderancaVotosTotal;
    const fromSettings = Number(appSettings?.meta_geral_votos || 0);
    if (fromSettings > 0) return fromSettings;
    return projecoes.reduce((a, p) => a + (p.meta_votos || 0), 0);
  }, [appSettings, projecoes, isAdminView, liderancaVotosTotal]);

  const liderancaMap = useMemo(() => new Map(liderancas.map(l => [l.id, l])), [liderancas]);

  const dobStats = useMemo(() => {
    let totalVotos = 0;
    const cidadesSet = new Set<string>();
    dobradinhas.forEach(d => {
      const dobVotos = d.votos_estimados || 0;
      const lid = d.lideranca_id ? liderancaMap.get(d.lideranca_id) : null;
      const lidVotos = lid ? ((lid as any).votos_estimados || 0) : 0;
      const votos = lidVotos > 0 ? lidVotos : dobVotos;
      totalVotos += votos;
      if (d.cidade_id) cidadesSet.add(d.cidade_id);
    });
    return { totalVotos, totalDobradinhas: dobradinhas.length, cidadesComDob: cidadesSet.size };
  }, [dobradinhas, liderancaMap]);


  const cidadesComLideranca = useMemo(() => {
    const cidSet = new Set<string>();
    liderancas.forEach(l => {
      if (l.cidade_base_id) cidSet.add(l.cidade_base_id);
      (l.cidades_representadas || []).forEach(cid => cidSet.add(cid));
    });
    return cidSet.size;
  }, [liderancas]);

  const stats = useMemo(() => {
    const totalVotosProjetados = liderancaVotosTotal;
    const totalVotosConfirmados = projecoes.reduce((a, p) => a + (p.votos_confirmados || 0), 0);
    // Para coordenadores, o "atingido" da meta é a soma das captações da equipe.
    // Para admin, mantém a soma das projeções de lideranças.
    const atingidoMeta = isAdminView ? totalVotosProjetados : captadosTotal;
    return {
      totalVotosProjetados,
      totalVotosConfirmados,
      metaGeral,
      atingidoMeta,
      percentualMeta: metaGeral > 0 ? Math.round((atingidoMeta / metaGeral) * 100) : 0,
      totalCidades: cidades.length,
      totalLiderancas: liderancas.length,
      cidadesComLideranca,
    };
  }, [cidades, liderancas, projecoes, liderancaVotosTotal, metaGeral, cidadesComLideranca, isAdminView, captadosTotal]);

  const cidadeMap = useMemo(() => new Map(cidades.map(c => [c.id, c])), [cidades]);

  const cidadeVotosMap = useMemo(() => {
    const map: Record<string, { projetados: number; confirmados: number; meta: number; liderancas: number }> = {};
    liderancas.forEach(l => {
      const cid = l.cidade_base_id;
      if (!cid) return;
      if (!map[cid]) map[cid] = { projetados: 0, confirmados: 0, meta: 0, liderancas: 0 };
      map[cid].projetados += ((l as any).votos_estimados || 0) + (cabosVotosByLider.get(l.id) || 0);
      map[cid].liderancas += 1;
    });
    projecoes.forEach(p => {
      if (!map[p.cidade_id]) map[p.cidade_id] = { projetados: 0, confirmados: 0, meta: 0, liderancas: 0 };
      map[p.cidade_id].confirmados += p.votos_confirmados || 0;
      map[p.cidade_id].meta += p.meta_votos || 0;
      if (map[p.cidade_id].projetados === 0 && (p.votos_projetados || 0) > 0) {
        map[p.cidade_id].projetados = p.votos_projetados || 0;
      }
    });
    return map;
  }, [liderancas, projecoes]);

  const topCidades = useMemo(() =>
    Object.entries(cidadeVotosMap)
      .map(([cid, data]) => ({
        id: cid,
        nome: cidadeMap.get(cid)?.nome || '',
        projetados: data.projetados,
        confirmados: data.confirmados,
        meta: data.meta,
        liderancas: data.liderancas,
      }))
      .filter(c => c.nome && c.projetados > 0)
      .sort((a, b) => b.projetados - a.projetados)
      .slice(0, 8),
    [cidadeVotosMap, cidadeMap]
  );

  // Cumulative time-series based on created_at of leadership/projection records
  const evolucao = useMemo(() => {
    const now = Date.now();
    const days = period === "all" ? null : Number(period);
    const cutoff = days ? now - days * 86400000 : 0;

    const lidsSorted = [...liderancas]
      .filter(l => (l as any).created_at)
      .sort((a, b) => new Date((a as any).created_at).getTime() - new Date((b as any).created_at).getTime());
    const projsSorted = [...projecoes]
      .filter(p => (p as any).created_at)
      .sort((a, b) => new Date((a as any).created_at).getTime() - new Date((b as any).created_at).getTime());

    // Determine range
    const earliest = Math.min(
      lidsSorted[0] ? new Date((lidsSorted[0] as any).created_at).getTime() : now,
      projsSorted[0] ? new Date((projsSorted[0] as any).created_at).getTime() : now,
    );
    const start = days ? Math.max(cutoff, earliest) : earliest;
    const totalDays = Math.max(1, Math.ceil((now - start) / 86400000));
    const step = totalDays > 60 ? Math.ceil(totalDays / 60) : 1;

    const buckets: { date: Date; projetados: number; captados: number; liderancas: number }[] = [];
    for (let d = new Date(start); d.getTime() <= now; d.setDate(d.getDate() + step)) {
      buckets.push({ date: new Date(d), projetados: 0, captados: 0, liderancas: 0 });
    }
    if (buckets.length === 0) buckets.push({ date: new Date(now), projetados: 0, captados: 0, liderancas: 0 });

    // Cumulative across ALL history up to each bucket
    buckets.forEach(b => {
      const t = b.date.getTime();
      let projVotos = 0;
      let lidCount = 0;
      let confirmados = 0;
      lidsSorted.forEach(l => {
        if (new Date((l as any).created_at).getTime() <= t) {
          projVotos += (l as any).votos_estimados || 0;
          lidCount += 1;
        }
      });
      projsSorted.forEach(p => {
        if (new Date((p as any).created_at).getTime() <= t) {
          confirmados += (p as any).votos_confirmados || 0;
        }
      });
      b.projetados = projVotos;
      b.captados = confirmados;
      b.liderancas = lidCount;
    });

    return buckets.map(b => ({
      label: b.date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
      projetados: b.projetados,
      captados: b.captados,
      liderancas: b.liderancas,
    }));
  }, [period, liderancas, projecoes]);

  // Growth indicators using first vs last in current period
  const growth = useMemo(() => {
    if (evolucao.length < 2) return { projetados: null, captados: null, liderancas: null };
    const first = evolucao[0];
    const last = evolucao[evolucao.length - 1];
    const pct = (a: number, b: number) => (b === 0 ? (a > 0 ? null : 0) : ((a - b) / b) * 100);
    return {
      projetados: pct(last.projetados, first.projetados),
      captados: pct(last.captados, first.captados),
      liderancas: pct(last.liderancas, first.liderancas),
    };
  }, [evolucao]);

  const liderancasPorForca = useMemo(() => {
    const counts = { alta: 0, media: 0, baixa: 0 };
    liderancas.forEach(l => { counts[l.forca_politica] = (counts[l.forca_politica] || 0) + 1; });
    return [
      { name: 'Alta', value: counts.alta, fill: 'hsl(142, 70%, 40%)' },
      { name: 'Média', value: counts.media, fill: 'hsl(38, 92%, 55%)' },
      { name: 'Baixa', value: counts.baixa, fill: 'hsl(0, 70%, 55%)' },
    ].filter(d => d.value > 0);
  }, [liderancas]);

  const alertas = useMemo(() => {
    const cidadesComEstimativa = new Set<string>();
    liderancas.forEach(l => {
      if ((l.votos_estimados || 0) > 0 && l.cidade_base_id) {
        cidadesComEstimativa.add(l.cidade_base_id);
      }
    });
    return [
      ...cidades
        .filter(c => !projecoes.find(p => p.cidade_id === c.id) && !cidadesComEstimativa.has(c.id))
        .map(c => ({ msg: `${c.nome} sem projeção de apoiadores`, type: 'warning' as const })),
      ...projecoes
        .filter(p => (p.votos_projetados || 0) < (p.meta_votos || 0) * 0.5)
        .map(p => ({ msg: `${cidadeMap.get(p.cidade_id)?.nome} abaixo de 50% da meta`, type: 'danger' as const })),
    ];
  }, [cidades, projecoes, cidadeMap, liderancas]);

  if (lc || ll || lp || ld || ls) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Carregando dados da campanha...</p>
      </div>
    );
  }

  const restante = Math.max(0, stats.metaGeral - stats.atingidoMeta);
  const radialData = [{ name: "meta", value: Math.min(stats.percentualMeta, 100), fill: "hsl(215, 80%, 55%)" }];

  return (
    <div className="min-h-screen bg-[#F5F7FA] -mx-4 -my-6 px-6 py-8 sm:px-8 lg:px-10 space-y-8 animate-fade-in">
      {/* Page Header */}
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            Inteligência Eleitoral · São Paulo
          </p>
          <h1 className="mt-1 text-[28px] sm:text-[32px] font-bold tracking-tight text-slate-900">
            Dashboard Estratégico
          </h1>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> {stats.totalCidades} cidades</span>
          <span className="h-1 w-1 rounded-full bg-slate-300" />
          <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> {stats.totalLiderancas} lideranças</span>
          <span className="h-1 w-1 rounded-full bg-slate-300" />
          <span className="flex items-center gap-1.5"><Handshake className="h-3.5 w-3.5" /> {dobStats.totalDobradinhas} dobradinhas</span>
        </div>
      </header>

      {/* HERO ROW — Two big executive cards */}
      <section className="grid gap-5 lg:grid-cols-2">
        {/* Meta Geral */}
        <Card className="relative overflow-hidden rounded-3xl border-0 shadow-lg bg-gradient-to-br from-[#0f1e3d] via-[#13284f] to-[#1e3a73] text-white">
          <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-blue-400/20 blur-3xl" />
          <CardContent className="relative p-7 sm:p-8">
            <div className="flex items-start justify-between mb-6">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-200/80">{isAdminView ? "Meta da Campanha" : "Sua Meta Projetada"}</p>
                <p className="mt-2 text-sm text-blue-100/70">{isAdminView ? "Objetivo total estabelecido" : "Progresso através das captações da equipe"}</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 backdrop-blur">
                <Target className="h-5 w-5 text-blue-200" />
              </div>
            </div>
            <p className="text-[44px] sm:text-[48px] font-bold tracking-tight leading-none tabular-nums">
              {stats.metaGeral.toLocaleString("pt-BR")}
              <span className="ml-2 text-base font-medium text-blue-200/80">apoiadores</span>
            </p>
            <div className="mt-7 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-blue-100/80">Progresso atual</span>
                <span className="font-bold text-white tabular-nums">{stats.percentualMeta}%</span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-300 transition-all duration-700"
                  style={{ width: `${Math.min(stats.percentualMeta, 100)}%` }}
                />
              </div>
              <p className="pt-1 text-xs text-blue-100/70">
                {restante > 0
                  ? <>Faltam <span className="font-semibold text-white">{restante.toLocaleString("pt-BR")}</span> apoiadores para a meta</>
                  : <span className="inline-flex items-center gap-1.5 text-emerald-300 font-semibold"><CheckCircle2 className="h-3.5 w-3.5" /> Meta atingida!</span>}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Votos Projetados */}
        <Card className="relative overflow-hidden rounded-3xl border border-slate-200/80 shadow-sm bg-white">
          <CardContent className="p-7 sm:p-8">
            <div className="flex items-start justify-between mb-6">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Apoiadores Projetados</p>
                <p className="mt-2 text-sm text-slate-500">Soma das estimativas de lideranças</p>
              </div>
              <GrowthBadge value={growth.projetados} />
            </div>
            <p className="text-[44px] sm:text-[48px] font-bold tracking-tight leading-none tabular-nums text-slate-900">
              {stats.totalVotosProjetados.toLocaleString("pt-BR")}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-sm font-semibold text-emerald-600">{stats.percentualMeta}%</span>
              <span className="text-xs text-slate-500">da meta geral</span>
            </div>
            <div className="mt-6 h-[120px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={evolucao} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="heroGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(215, 80%, 55%)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="hsl(215, 80%, 55%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="projetados" name="Projetados"
                    stroke="hsl(215, 80%, 55%)" strokeWidth={2.5} fill="url(#heroGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Secondary KPIs */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7">
        <MiniStat title="Apoiadores Captados" value={captadosTotal} subtitle="QR cadastros únicos" icon={Vote} accent="blue" />
        <MiniStat title="Apoiadores Confirmados" value={stats.totalVotosConfirmados} subtitle={`${stats.percentualMeta}% da meta`} icon={CheckCircle2} accent="green" />
        <MiniStat title="Lideranças" value={stats.totalLiderancas} subtitle="cadastradas" icon={Users} growth={growth.liderancas} accent="violet" />
        <MiniStat title="Cabos Eleitorais" value={cabos.length} subtitle={`+${cabosVotosTotal.toLocaleString("pt-BR")} apoiadores`} icon={Megaphone} accent="orange" />
        <MiniStat title="Cidades Mapeadas" value={stats.totalCidades} subtitle="no estado" icon={Building2} accent="slate" />
        <MiniStat title="Dobradinhas" value={dobStats.totalDobradinhas} subtitle="parcerias ativas" icon={Handshake} accent="orange" />
        <MiniStat title="Cidades c/ Liderança" value={stats.cidadesComLideranca} subtitle={`de ${stats.totalCidades} cidades`} icon={MapPin} accent="rose" />
      </section>

      {/* EVOLUÇÃO + META RADIAL */}
      <section className="grid gap-5 lg:grid-cols-3">
        {/* Big evolution chart */}
        <Card className="lg:col-span-2 rounded-3xl border-slate-200/80 shadow-sm bg-white">
          <CardContent className="p-6 sm:p-7">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Activity className="h-4.5 w-4.5 text-blue-600" />
                  Evolução da Campanha
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">Crescimento acumulado de apoiadores e lideranças</p>
              </div>
              <div className="inline-flex items-center gap-1 rounded-full bg-slate-100 p-1">
                {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
                  <Button
                    key={p}
                    onClick={() => setPeriod(p)}
                    size="sm"
                    variant="ghost"
                    className={cn(
                      "h-7 rounded-full px-3 text-xs font-medium transition-all",
                      period === p ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    {PERIOD_LABELS[p]}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-5">
              {[
                { label: "Projetados", value: stats.totalVotosProjetados, color: "bg-blue-500", g: growth.projetados },
                { label: "Captados", value: stats.totalVotosConfirmados, color: "bg-emerald-500", g: growth.captados },
                { label: "Lideranças", value: stats.totalLiderancas, color: "bg-violet-500", g: growth.liderancas },
              ].map(s => (
                <div key={s.label} className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                    <span className={cn("h-2 w-2 rounded-full", s.color)} />
                    <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">{s.label}</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-bold tabular-nums text-slate-900">{s.value.toLocaleString("pt-BR")}</span>
                    <GrowthBadge value={s.g} />
                  </div>
                </div>
              ))}
            </div>

            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={evolucao} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradProj" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(215, 80%, 55%)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="hsl(215, 80%, 55%)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradCap" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(142, 70%, 42%)" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="hsl(142, 70%, 42%)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradLid" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(265, 70%, 60%)" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="hsl(265, 70%, 60%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(214, 20%, 92%)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(215, 15%, 50%)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(215, 15%, 50%)" }} axisLine={false} tickLine={false}
                    tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="projetados" name="Projetados" stroke="hsl(215, 80%, 55%)" strokeWidth={2.5} fill="url(#gradProj)" />
                  <Area type="monotone" dataKey="captados" name="Captados" stroke="hsl(142, 70%, 42%)" strokeWidth={2.5} fill="url(#gradCap)" />
                  <Area type="monotone" dataKey="liderancas" name="Lideranças" stroke="hsl(265, 70%, 60%)" strokeWidth={2} fill="url(#gradLid)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Radial meta gauge */}
        <Card className="rounded-3xl border-slate-200/80 shadow-sm bg-white">
          <CardContent className="p-6 sm:p-7 flex flex-col h-full">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Target className="h-4.5 w-4.5 text-blue-600" />
                Acompanhamento da Meta
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">Visão consolidada do progresso</p>
            </div>

            <div className="relative flex-1 flex items-center justify-center min-h-[220px]">
              <ResponsiveContainer width="100%" height={240}>
                <RadialBarChart innerRadius="72%" outerRadius="100%" data={radialData} startAngle={90} endAngle={-270}>
                  <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                  <RadialBar background={{ fill: "hsl(214, 32%, 94%)" }} dataKey="value" cornerRadius={20} fill="url(#radialGrad)" />
                  <defs>
                    <linearGradient id="radialGrad" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="hsl(215, 80%, 55%)" />
                      <stop offset="100%" stopColor="hsl(190, 80%, 50%)" />
                    </linearGradient>
                  </defs>
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <p className="text-[42px] font-bold tabular-nums leading-none text-slate-900">
                  {stats.percentualMeta}<span className="text-xl text-slate-400">%</span>
                </p>
                <p className="mt-1 text-[11px] uppercase tracking-wider text-slate-500 font-semibold">atingido</p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Meta</p>
                <p className="text-sm font-bold tabular-nums text-slate-900">{stats.metaGeral.toLocaleString("pt-BR")}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Projetados</p>
                <p className="text-sm font-bold tabular-nums text-blue-600">{stats.totalVotosProjetados.toLocaleString("pt-BR")}</p>
              </div>
              <div className="col-span-2">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Restante</p>
                <p className="text-sm font-bold tabular-nums text-orange-600">{restante.toLocaleString("pt-BR")} <span className="text-xs font-normal text-slate-500">apoiadores</span></p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* TOP CIDADES + LIDERANÇAS POR FORÇA */}
      <section className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2 rounded-3xl border-slate-200/80 shadow-sm bg-white">
          <CardContent className="p-6 sm:p-7">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Trophy className="h-4.5 w-4.5 text-amber-500" />
                  Top Cidades
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">Ranking por apoiadores projetados</p>
              </div>
              <Badge variant="secondary" className="rounded-full text-[11px] bg-slate-100 text-slate-700 hover:bg-slate-100">
                {topCidades.length} cidades
              </Badge>
            </div>

            {topCidades.length === 0 ? (
              <div className="py-16 text-center text-sm text-slate-400">
                Cadastre projeções para visualizar o ranking
              </div>
            ) : (
              <div className="space-y-2">
                {topCidades.map((c, i) => {
                  const metaLocal = c.meta > 0 ? c.meta : (stats.metaGeral / Math.max(stats.totalCidades, 1));
                  const pct = metaLocal > 0 ? Math.min(100, Math.round((c.projetados / metaLocal) * 100)) : 0;
                  const Icon = i === 0 ? Crown : i === 1 ? Trophy : i === 2 ? Medal : null;
                  const rankBg = i === 0 ? "bg-amber-100 text-amber-700" : i === 1 ? "bg-slate-200 text-slate-700" : i === 2 ? "bg-orange-100 text-orange-700" : "bg-slate-50 text-slate-500";
                  return (
                    <div key={c.id} className="group flex items-center gap-4 rounded-2xl border border-transparent p-3 hover:border-slate-200 hover:bg-slate-50/70 transition-all duration-200">
                      <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold", rankBg)}>
                        {Icon ? <Icon className="h-4 w-4" /> : i + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <p className="truncate text-sm font-semibold text-slate-900">{c.nome}</p>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="hidden sm:inline-flex text-[11px] text-slate-500">
                              <Users className="h-3 w-3 mr-1 inline" />{c.liderancas} líder{c.liderancas !== 1 ? "es" : ""}
                            </span>
                            <span className="text-sm font-bold tabular-nums text-slate-900">{c.projetados.toLocaleString("pt-BR")}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className={cn("h-full rounded-full transition-all duration-500",
                                pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-blue-500" : "bg-orange-400")}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-[11px] font-semibold tabular-nums text-slate-500 w-10 text-right">{pct}%</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Lideranças por Força */}
        <Card className="rounded-3xl border-slate-200/80 shadow-sm bg-white">
          <CardContent className="p-6 sm:p-7">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Award className="h-4.5 w-4.5 text-violet-600" />
                Lideranças por Força
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">Distribuição estratégica</p>
            </div>

            {liderancasPorForca.length === 0 ? (
              <div className="py-12 text-center text-sm text-slate-400">Sem lideranças cadastradas</div>
            ) : (
              <>
                <div className="relative h-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={liderancasPorForca} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value" stroke="none">
                        {liderancasPorForca.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                      </Pie>
                      <Tooltip content={<ChartTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <p className="text-2xl font-bold tabular-nums text-slate-900">{stats.totalLiderancas}</p>
                    <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">total</p>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  {liderancasPorForca.map(d => {
                    const pct = stats.totalLiderancas > 0 ? Math.round((d.value / stats.totalLiderancas) * 100) : 0;
                    return (
                      <div key={d.name} className="flex items-center gap-3 text-xs">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.fill }} />
                        <span className="text-slate-600 flex-1">{d.name}</span>
                        <span className="font-semibold tabular-nums text-slate-900">{d.value}</span>
                        <span className="text-slate-400 tabular-nums w-9 text-right">{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ALERTAS + TOP LIDERANÇAS */}
      <section className="grid gap-5 lg:grid-cols-2">
        <Card className="rounded-3xl border-slate-200/80 shadow-sm bg-white">
          <CardContent className="p-6 sm:p-7">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <AlertTriangle className="h-4.5 w-4.5 text-orange-500" />
                  Alertas Estratégicos
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">Pontos que precisam de atenção</p>
              </div>
              {alertas.length > 0 && (
                <Badge className="rounded-full bg-orange-100 text-orange-700 hover:bg-orange-100 border-0">
                  {alertas.length}
                </Badge>
              )}
            </div>
            <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
              {alertas.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="h-12 w-12 rounded-2xl bg-emerald-50 flex items-center justify-center mb-3">
                    <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                  </div>
                  <p className="text-sm font-semibold text-slate-900">Tudo em ordem!</p>
                  <p className="text-xs text-slate-500">Nenhum alerta no momento</p>
                </div>
              ) : (
                alertas.slice(0, 8).map((a, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex items-start gap-3 rounded-2xl border p-3 text-sm transition-colors",
                      a.type === "danger"
                        ? "border-red-100 bg-red-50/60 hover:bg-red-50"
                        : "border-orange-100 bg-orange-50/60 hover:bg-orange-50"
                    )}
                  >
                    <div className={cn(
                      "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg",
                      a.type === "danger" ? "bg-red-100 text-red-600" : "bg-orange-100 text-orange-600"
                    )}>
                      <AlertTriangle className="h-3.5 w-3.5" />
                    </div>
                    <p className="text-xs leading-relaxed text-slate-700 flex-1">{a.msg}</p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-slate-200/80 shadow-sm bg-white">
          <CardContent className="p-6 sm:p-7">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Crown className="h-4.5 w-4.5 text-amber-500" />
                  Top Lideranças
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">Maiores estimativas de apoiadores</p>
              </div>
              <ArrowUpRight className="h-4 w-4 text-slate-300" />
            </div>
            <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
              {liderancas
                .filter(l => l.status === "ativa")
                .sort((a, b) => ((b as any).votos_estimados || 0) - ((a as any).votos_estimados || 0))
                .slice(0, 6)
                .map((l, i) => {
                  const rankBg = i === 0 ? "bg-amber-100 text-amber-700" : i === 1 ? "bg-slate-200 text-slate-700" : i === 2 ? "bg-orange-100 text-orange-700" : "bg-slate-50 text-slate-500";
                  const forcaColor = l.forca_politica === "alta" ? "bg-emerald-100 text-emerald-700" : l.forca_politica === "media" ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700";
                  return (
                    <div key={l.id} className="flex items-center gap-3 rounded-2xl border border-transparent p-2.5 hover:border-slate-200 hover:bg-slate-50/70 transition-all">
                      <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold", rankBg)}>
                        {i + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-900">{l.nome}</p>
                        <p className="truncate text-[11px] text-slate-500">{cidadeMap.get(l.cidade_base_id || "")?.nome || "—"}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold tabular-nums text-slate-900">
                          {((l as any).votos_estimados || 0).toLocaleString("pt-BR")}
                        </p>
                        <span className={cn("inline-block mt-0.5 rounded-full px-1.5 py-0 text-[9px] font-semibold uppercase", forcaColor)}>
                          {l.forca_politica}
                        </span>
                      </div>
                    </div>
                  );
                })}
              {liderancas.filter(l => l.status === "ativa").length === 0 && (
                <div className="py-12 text-center text-sm text-slate-400">Cadastre lideranças ativas</div>
              )}
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
