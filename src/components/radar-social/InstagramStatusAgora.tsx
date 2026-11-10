import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Activity, Users, Eye, Heart, MessageSquare, BarChart3,
  Bookmark, Share2, TrendingUp, TrendingDown, Minus, Clock,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface SnapshotRow {
  snapshot_date: string;
  followers: number;
  profile_views: number;
  total_likes: number;
  total_comments: number;
  total_reach: number;
  total_impressions: number;
  total_saves: number;
  total_shares: number;
  total_posts: number;
  avg_engagement: number;
}

function formatNum(n: number | null | undefined) {
  if (!n) return "0";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString("pt-BR");
}

function Delta({ current, previous }: { current: number; previous?: number }) {
  if (previous === undefined || previous === null) {
    return (
      <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
        <Minus className="h-2.5 w-2.5" /> sem histórico
      </span>
    );
  }
  const diff = current - previous;
  if (diff === 0) {
    return (
      <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
        <Minus className="h-2.5 w-2.5" /> estável
      </span>
    );
  }
  const positive = diff > 0;
  return (
    <span
      className={`text-[10px] font-semibold flex items-center gap-0.5 ${
        positive ? "text-emerald-600" : "text-red-600"
      }`}
    >
      {positive ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
      {positive ? "+" : ""}
      {formatNum(diff)}
    </span>
  );
}

interface MetricBoxProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  previous?: number;
  accent: string;
}

function MetricBox({ icon, label, value, previous, accent }: MetricBoxProps) {
  return (
    <div className="bg-muted/40 rounded-lg p-2.5 border border-border/40">
      <div className="flex items-center justify-between mb-1">
        <div className={`flex items-center gap-1 text-[10px] uppercase tracking-wider font-medium ${accent}`}>
          {icon}
          <span>{label}</span>
        </div>
      </div>
      <p className="text-xl font-bold text-foreground leading-tight">{formatNum(value)}</p>
      <Delta current={value} previous={previous} />
    </div>
  );
}

export function InstagramStatusAgora() {
  const queryClient = useQueryClient();

  // Reaproveita o cache da edge function 'instagram-insights' (já chamada pela aba Relatório)
  const { data: insights, isLoading: loadingInsights } = useQuery({
    queryKey: ["instagram-insights"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("instagram-insights");
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro");
      return data;
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const { data: snapshots, isLoading: loadingSnapshots } = useQuery({
    queryKey: ["instagram-daily-snapshots"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("instagram_daily_snapshots")
        .select("*")
        .order("snapshot_date", { ascending: false })
        .limit(7);
      if (error) throw error;
      return (data || []) as SnapshotRow[];
    },
    staleTime: 60 * 1000,
  });

  // Salva/atualiza snapshot do dia automaticamente quando os insights chegam
  useEffect(() => {
    if (!insights?.success) return;
    const today = new Date().toISOString().slice(0, 10);

    const payload = {
      snapshot_date: today,
      followers: insights.profile?.followers || 0,
      following: insights.profile?.following || 0,
      media_count: insights.profile?.mediaCount || 0,
      profile_views: insights.profile?.profileViews || 0,
      total_likes: insights.summary?.totalLikes || 0,
      total_comments: insights.summary?.totalComments || 0,
      total_reach: insights.summary?.totalReach || 0,
      total_impressions: insights.summary?.totalImpressions || 0,
      total_saves: insights.summary?.totalSaves || 0,
      total_shares: insights.summary?.totalShares || 0,
      total_posts: insights.summary?.totalPosts || 0,
      avg_engagement: insights.summary?.avgEngagement || 0,
    };

    (async () => {
      const { error } = await supabase
        .from("instagram_daily_snapshots")
        .upsert(payload, { onConflict: "snapshot_date" });
      if (!error) {
        queryClient.invalidateQueries({ queryKey: ["instagram-daily-snapshots"] });
      }
    })();
  }, [insights, queryClient]);

  const todaySnapshot = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return snapshots?.find((s) => s.snapshot_date === today);
  }, [snapshots]);

  const previousSnapshot = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return snapshots?.find((s) => s.snapshot_date !== today);
  }, [snapshots]);

  const isLoading = loadingInsights || loadingSnapshots;

  if (isLoading && !insights) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!insights?.success) {
    return null;
  }

  // Usa o snapshot salvo de hoje OU os insights ao vivo (caso ainda não tenha gravado)
  const current = todaySnapshot ?? {
    followers: insights.profile?.followers || 0,
    profile_views: insights.profile?.profileViews || 0,
    total_likes: insights.summary?.totalLikes || 0,
    total_comments: insights.summary?.totalComments || 0,
    total_reach: insights.summary?.totalReach || 0,
    total_impressions: insights.summary?.totalImpressions || 0,
    total_saves: insights.summary?.totalSaves || 0,
    total_shares: insights.summary?.totalShares || 0,
  };

  const lastUpdate = new Date();

  return (
    <Card className="border-pink-500/20 bg-gradient-to-br from-pink-500/5 via-background to-purple-500/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4 text-pink-500 animate-pulse" />
            Status Agora
          </CardTitle>
          <Badge variant="outline" className="text-[10px] gap-1 border-pink-500/30">
            <Clock className="h-2.5 w-2.5" />
            {format(lastUpdate, "HH:mm", { locale: ptBR })}
          </Badge>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {previousSnapshot
            ? `Comparando com ${format(new Date(previousSnapshot.snapshot_date + "T00:00:00"), "dd 'de' MMMM", { locale: ptBR })}`
            : "Primeiro registro do dia — variação aparecerá amanhã"}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <MetricBox
            icon={<Users className="h-3 w-3" />}
            label="Seguidores"
            value={current.followers}
            previous={previousSnapshot?.followers}
            accent="text-blue-600"
          />
          <MetricBox
            icon={<Eye className="h-3 w-3" />}
            label="Visitas Perfil"
            value={current.profile_views}
            previous={previousSnapshot?.profile_views}
            accent="text-purple-600"
          />
          <MetricBox
            icon={<Heart className="h-3 w-3" />}
            label="Curtidas"
            value={current.total_likes}
            previous={previousSnapshot?.total_likes}
            accent="text-red-500"
          />
          <MetricBox
            icon={<MessageSquare className="h-3 w-3" />}
            label="Comentários"
            value={current.total_comments}
            previous={previousSnapshot?.total_comments}
            accent="text-amber-600"
          />
          <MetricBox
            icon={<BarChart3 className="h-3 w-3" />}
            label="Alcance"
            value={current.total_reach}
            previous={previousSnapshot?.total_reach}
            accent="text-emerald-600"
          />
          <MetricBox
            icon={<TrendingUp className="h-3 w-3" />}
            label="Impressões"
            value={current.total_impressions}
            previous={previousSnapshot?.total_impressions}
            accent="text-indigo-600"
          />
          <MetricBox
            icon={<Bookmark className="h-3 w-3" />}
            label="Salvamentos"
            value={current.total_saves}
            previous={previousSnapshot?.total_saves}
            accent="text-cyan-600"
          />
          <MetricBox
            icon={<Share2 className="h-3 w-3" />}
            label="Compart."
            value={current.total_shares}
            previous={previousSnapshot?.total_shares}
            accent="text-pink-600"
          />
        </div>

        {snapshots && snapshots.length > 1 && (
          <div className="pt-2 border-t border-border/40">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5">
              Últimos {snapshots.length} dias
            </p>
            <div className="flex gap-1 overflow-x-auto">
              {[...snapshots].reverse().map((s) => (
                <div
                  key={s.snapshot_date}
                  className="flex-shrink-0 text-center bg-muted/30 rounded px-2 py-1 min-w-[52px]"
                  title={`${s.snapshot_date}: ${s.followers} seguidores`}
                >
                  <p className="text-[9px] text-muted-foreground">
                    {format(new Date(s.snapshot_date + "T00:00:00"), "dd/MM")}
                  </p>
                  <p className="text-xs font-bold">{formatNum(s.followers)}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
