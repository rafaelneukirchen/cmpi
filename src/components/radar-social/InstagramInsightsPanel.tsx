import { useState, useRef, useCallback } from "react";
import { toPng } from "html-to-image";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import {
  Heart, MessageSquare, Eye, Share2, Bookmark, Play, TrendingUp,
  Users, BarChart3, RefreshCw, ExternalLink, Award, Zap, Target,
  UserPlus, Trash2, Search, Info, ChevronDown, ChevronUp, Plus, Minus, Edit3, UserCheck, Download,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

function formatNum(n: number | null | undefined) {
  if (!n) return "0";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString("pt-BR");
}

function mediaTypeLabel(type: string) {
  switch (type) {
    case "IMAGE": return "📷 Foto";
    case "VIDEO": return "🎬 Vídeo/Reel";
    case "CAROUSEL_ALBUM": return "🎠 Carrossel";
    default: return type;
  }
}

export function InstagramInsightsPanel() {
  const queryClient = useQueryClient();
  const [newUsername, setNewUsername] = useState("");
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [rankingLimit, setRankingLimit] = useState(10);

  const { data, isLoading, error, refetch, isFetching, dataUpdatedAt } = useQuery({
    queryKey: ["instagram-insights"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("instagram-insights");
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro desconhecido");
      return data;
    },
    staleTime: 1000 * 60 * 10,
    refetchInterval: 1000 * 60 * 10, // Auto-refresh a cada 10 minutos
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    retry: false,
  });

  // Load tracked usernames from social_engagers
  const { data: trackedUsers = [] } = useQuery({
    queryKey: ["tracked-engagers"],
    queryFn: async () => {
      const { data: profiles } = await supabase
        .from("social_discovery_profiles" as any)
        .select("id, username")
        .eq("plataforma", "instagram")
        .limit(10);
      
      if (!profiles || profiles.length === 0) return [];

      const ownerUsername = data?.profile?.username;
      const ownProfile = ownerUsername 
        ? (profiles as any[]).find((p: any) => p.username.toLowerCase() === ownerUsername.toLowerCase())
        : (profiles as any[])[0];
      
      if (!ownProfile) return [];

      const { data: engagers } = await supabase
        .from("social_engagers" as any)
        .select("*")
        .eq("profile_id", ownProfile.id)
        .order("total_comentarios", { ascending: false });

      return (engagers || []) as any[];
    },
    enabled: !!data?.profile?.username,
  });

  const addTrackedUser = useMutation({
    mutationFn: async (username: string) => {
      const cleanUsername = username.replace("@", "").trim().toLowerCase();
      if (!cleanUsername) throw new Error("Username inválido");

      const ownerUsername = data?.profile?.username;
      let profileId: string;

      const { data: existing } = await supabase
        .from("social_discovery_profiles" as any)
        .select("id")
        .eq("username", ownerUsername)
        .eq("plataforma", "instagram")
        .maybeSingle();

      if (existing) {
        profileId = (existing as any).id;
      } else {
        const { data: created, error } = await supabase
          .from("social_discovery_profiles" as any)
          .insert({
            nome: data?.profile?.name || ownerUsername,
            username: ownerUsername,
            plataforma: "instagram",
            url_perfil: `https://instagram.com/${ownerUsername}`,
            foto_url: data?.profile?.picture,
          })
          .select("id")
          .single();
        if (error) throw error;
        profileId = (created as any).id;
      }

      const { data: existingEngager } = await supabase
        .from("social_engagers" as any)
        .select("id")
        .eq("profile_id", profileId)
        .eq("username", cleanUsername)
        .maybeSingle();

      if (existingEngager) throw new Error("Este @ já está sendo monitorado");

      // Check if this user has interactions from live data
      const interactions = data?.userInteractions?.[cleanUsername] || [];
      const engagerData = data?.topEngagers?.find((e: any) => e.username.toLowerCase() === cleanUsername);

      const totalComments = engagerData?.comments || interactions.length || 0;
      const lastInteraction = engagerData?.lastInteraction || (interactions.length > 0 ? interactions[0].timestamp : null);

      let freq = "pendente";
      if (totalComments >= 5) freq = "alta";
      else if (totalComments >= 2) freq = "média";
      else if (totalComments >= 1) freq = "baixa";

      const { error } = await supabase
        .from("social_engagers" as any)
        .insert({
          profile_id: profileId,
          username: cleanUsername,
          total_comentarios: totalComments,
          ultima_interacao: lastInteraction,
          frequencia_interacao: freq,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tracked-engagers"] });
      setNewUsername("");
      toast.success("Seguidor adicionado ao monitoramento!");
    },
    onError: (err: any) => toast.error(err.message || "Erro ao adicionar"),
  });

  const removeTrackedUser = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("social_engagers" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tracked-engagers"] });
      toast.success("Removido do monitoramento");
    },
  });

  const updateEngagerStatus = useMutation({
    mutationFn: async ({ id, status, comments }: { id: string; status: string; comments?: number }) => {
      const update: any = {
        frequencia_interacao: status,
        ultima_interacao: status !== "pendente" ? new Date().toISOString() : null,
      };
      if (comments !== undefined) update.total_comentarios = comments;
      const { error } = await supabase
        .from("social_engagers" as any)
        .update(update)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tracked-engagers"] });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {String(error).includes("TOKEN_EXPIRADO")
            ? "O token do Instagram expirou. Atualize nas configurações de integração."
            : `Erro ao carregar insights: ${error instanceof Error ? error.message : "Desconhecido"}`}
        </AlertDescription>
      </Alert>
    );
  }

  if (!data) return null;

  const { profile, summary, bestByLikes, bestByComments, bestByReach, bestByShares, topEngagers, userInteractions, typeBreakdown, recentPosts, capabilities } = data;

  // Métricas de HOJE — baseadas em interações recebidas hoje + posts das últimas 24h
  const todayStr = new Date().toISOString().slice(0, 10);
  const last24hMs = Date.now() - 24 * 60 * 60 * 1000;

  // Posts publicados nas últimas 24h (para reach/shares/saves do dia)
  const todayPosts = (recentPosts || []).filter((p: any) => {
    const t = p.timestamp ? new Date(p.timestamp).getTime() : 0;
    return t >= last24hMs;
  });

  // Comentários recebidos HOJE em QUALQUER post (não só os de hoje)
  const allInteractionsToday = Object.values(userInteractions || {})
    .flat()
    .filter((i: any) => (i.timestamp || "").slice(0, 10) === todayStr);
  const todayInteractions = allInteractionsToday.length;
  const todayComments = todayInteractions; // cada interação rastreada é um comentário

  // Curtidas de hoje: soma das curtidas dos posts publicados nas últimas 24h
  // (a Graph API não expõe timestamp por curtida, então usamos posts recentes como proxy)
  const todayLikes = todayPosts.reduce((s: number, p: any) => s + (p.like_count || 0), 0);
  const todayReach = todayPosts.reduce((s: number, p: any) => s + (p.insights?.reach || 0), 0);
  const todayShares = todayPosts.reduce((s: number, p: any) => s + (p.insights?.shares || 0), 0);
  const todaySaves = todayPosts.reduce((s: number, p: any) => s + (p.insights?.saved || 0), 0);
  // Validação real: se a API retornou QUALQUER métrica de insights (reach, shares, saves, plays ou profile_views), considera disponível
  const hasInsights =
    capabilities?.insights ||
    (summary.totalReach ?? 0) > 0 ||
    (summary.totalShares ?? 0) > 0 ||
    (summary.totalSaves ?? 0) > 0 ||
    (summary.totalPlays ?? 0) > 0 ||
    (summary.profileViews ?? 0) > 0;
  const hasCommentsApi = capabilities?.comments || (topEngagers?.length > 0);

  // Cross-reference tracked users with live engager data and auto-update
  // Fonte primária: userInteractions (mapa COMPLETO de TODOS os comentários, sem limite de top 20)
  const enrichedTracked = trackedUsers.map((t: any) => {
    const uname = t.username.toLowerCase();
    const interactions = userInteractions?.[uname] || [];
    const liveData = topEngagers?.find((e: any) => e.username.toLowerCase() === uname);

    // Calcula contagem real e última interação a partir do mapa completo
    const liveCommentsCount = interactions.length || liveData?.comments || 0;
    const liveLastDate = interactions.length > 0
      ? interactions.reduce((max: string, i: any) => (i.timestamp > max ? i.timestamp : max), interactions[0].timestamp)
      : liveData?.lastInteraction || null;

    if (liveCommentsCount > 0 && (liveCommentsCount !== t.total_comentarios || !t.ultima_interacao)) {
      const freq = liveCommentsCount >= 5 ? "alta" : liveCommentsCount >= 2 ? "média" : "baixa";
      supabase
        .from("social_engagers" as any)
        .update({
          total_comentarios: liveCommentsCount,
          ultima_interacao: liveLastDate,
          frequencia_interacao: freq,
        } as any)
        .eq("id", t.id)
        .then();
    }

    return {
      ...t,
      liveComments: liveCommentsCount || t.total_comentarios || 0,
      liveLastInteraction: liveLastDate || t.ultima_interacao || null,
      liveFrequency: liveCommentsCount > 0
        ? (liveCommentsCount >= 5 ? "alta" : liveCommentsCount >= 2 ? "média" : "baixa")
        : t.frequencia_interacao,
      interactions,
    };
  });

  // Build KPI list
  const kpis = [
    { label: "Visitas ao Perfil", value: formatNum(summary.profileViews ?? 0), icon: UserCheck, color: "text-pink-500", show: true },
    { label: "Curtidas", value: formatNum(summary.totalLikes), icon: Heart, color: "text-red-500", show: true },
    { label: "Comentários", value: formatNum(summary.totalComments), icon: MessageSquare, color: "text-blue-500", show: true },
    { label: "Engajamento Médio", value: `${summary.avgEngagement}%`, icon: Zap, color: "text-yellow-500", show: true },
    { label: "Posts Analisados", value: String(summary.totalPosts), icon: BarChart3, color: "text-indigo-500", show: true },
    { label: "Alcance Total", value: formatNum(summary.totalReach), icon: Eye, color: "text-amber-500", show: hasInsights },
    { label: "Compartilhamentos", value: formatNum(summary.totalShares), icon: Share2, color: "text-cyan-500", show: hasInsights },
    { label: "Salvamentos", value: formatNum(summary.totalSaves), icon: Bookmark, color: "text-emerald-500", show: hasInsights },
    { label: "Reproduções", value: formatNum(summary.totalPlays), icon: Play, color: "text-orange-500", show: hasInsights && summary.totalPlays > 0 },
  ].filter(k => k.show);

  const getStatusBadge = (freq: string, comments: number) => {
    if (comments >= 5) return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200 text-[10px]">🟢 Muito ativo</Badge>;
    if (comments >= 2) return <Badge className="bg-blue-500/10 text-blue-600 border-blue-200 text-[10px]">🔵 Ativo</Badge>;
    if (comments >= 1) return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-200 text-[10px]">🟡 Pouco ativo</Badge>;
    return <Badge className="bg-muted text-muted-foreground text-[10px]">⚪ Sem interação detectada</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Profile header */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center gap-4">
            {profile.picture && (
              <img src={profile.picture} alt={profile.name} className="w-16 h-16 rounded-full border-2 border-primary" />
            )}
            <div className="flex-1">
              <h2 className="text-xl font-bold">{profile.name}</h2>
              <p className="text-sm text-muted-foreground">@{profile.username}</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
                <RefreshCw className={`h-4 w-4 mr-1 ${isFetching ? "animate-spin" : ""}`} />
                Atualizar
              </Button>
              {dataUpdatedAt && (
                <p className="text-[10px] text-muted-foreground">
                  Auto a cada 10min · Última: {new Date(dataUpdatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 mt-4 text-center">
            <div>
              <p className="text-2xl font-bold">{formatNum(profile.followers)}</p>
              <p className="text-xs text-muted-foreground">Seguidores</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{formatNum(profile.following)}</p>
              <p className="text-xs text-muted-foreground">Seguindo</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{formatNum(profile.mediaCount)}</p>
              <p className="text-xs text-muted-foreground">Publicações</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* HOJE — Engajamento do dia atual */}
      <Card className="border-pink-500/30 bg-gradient-to-br from-pink-500/5 to-transparent">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="h-4 w-4 text-pink-500" /> Engajamento de Hoje
            <Badge variant="outline" className="text-[10px] ml-auto">
              {new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })}
            </Badge>
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {todayInteractions} comentário(s) recebido(s) hoje · {todayPosts.length} publicação(ões) nas últimas 24h
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="text-center p-2 rounded-lg bg-background/60 border">
              <Heart className="h-4 w-4 text-red-500 mx-auto mb-1" />
              <p className="text-lg font-bold">{formatNum(todayLikes)}</p>
              <p className="text-[10px] text-muted-foreground">Curtidas hoje</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-background/60 border">
              <MessageSquare className="h-4 w-4 text-blue-500 mx-auto mb-1" />
              <p className="text-lg font-bold">{formatNum(todayComments)}</p>
              <p className="text-[10px] text-muted-foreground">Comentários hoje</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-background/60 border">
              <Eye className="h-4 w-4 text-amber-500 mx-auto mb-1" />
              <p className="text-lg font-bold">{formatNum(todayReach)}</p>
              <p className="text-[10px] text-muted-foreground">Alcance hoje</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-background/60 border">
              <Share2 className="h-4 w-4 text-cyan-500 mx-auto mb-1" />
              <p className="text-lg font-bold">{formatNum(todayShares)}</p>
              <p className="text-[10px] text-muted-foreground">Compart. hoje</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-background/60 border">
              <Bookmark className="h-4 w-4 text-emerald-500 mx-auto mb-1" />
              <p className="text-lg font-bold">{formatNum(todaySaves)}</p>
              <p className="text-[10px] text-muted-foreground">Salvos hoje</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* RANKING MENSAL — Top Comentaristas */}
      {hasCommentsApi && topEngagers && topEngagers.length > 0 && (
        <div>
          {/* Controls outside the capture area */}
          <div className="flex items-center justify-between mb-2">
            <div />
            <div className="flex items-center gap-2">
              <select
                value={rankingLimit}
                onChange={(e) => setRankingLimit(Number(e.target.value))}
                className="h-7 text-xs rounded border bg-background px-2"
              >
                {[5, 10, 15, 20].map(n => (
                  <option key={n} value={n}>Top {n}</option>
                ))}
              </select>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1"
                onClick={async () => {
                  const el = document.getElementById("ranking-capture");
                  if (!el) return;
                  try {
                    const dataUrl = await toPng(el, {
                      backgroundColor: "#111215",
                      pixelRatio: 3,
                      cacheBust: true,
                    });
                    const a = document.createElement("a");
                    a.href = dataUrl;
                    a.download = `ranking-comentaristas-top${rankingLimit}.png`;
                    a.click();
                    toast.success(`Imagem do ranking Top ${rankingLimit} salva!`);
                  } catch (err) {
                    toast.error("Erro ao gerar imagem do ranking");
                  }
                }}
              >
                <Download className="h-3 w-3" /> Baixar Imagem
              </Button>
            </div>
          </div>

          {/* Capture area — uses solid colors for perfect image export */}
          <div
            id="ranking-capture"
            className="rounded-xl overflow-hidden"
            style={{ background: "#111215", border: "1px solid #b4860d" }}
          >
            {/* Header */}
            <div className="px-5 pt-5 pb-3" style={{ borderBottom: "1px solid #2a2318" }}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">🏆</span>
                <h3 className="text-base font-bold tracking-tight" style={{ color: "#f5f5f5" }}>
                  Ranking do Mês
                </h3>
                <span
                  className="ml-auto text-[10px] font-semibold rounded-full px-2.5 py-0.5"
                  style={{ color: "#f5c842", background: "#2a2005", border: "1px solid #b4860d" }}
                >
                  Últimos 30 dias
                </span>
              </div>
              <p className="text-xs pl-9" style={{ color: "#9ca3af" }}>
                Top {rankingLimit} pessoas que mais comentaram
              </p>
            </div>

            {/* List */}
            <div className="px-3 pb-4 pt-2 space-y-1.5">
              {topEngagers.slice(0, rankingLimit).map((e: any, i: number) => {
                const isTop3 = i < 3;
                const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null;

                const rowBg = i === 0 ? "#1f1a0a" : i === 1 ? "#1a1709" : i === 2 ? "#171509" : "#18181b";
                const rowBorder = i === 0 ? "#b4860d" : i === 1 ? "#7a5c0e" : i === 2 ? "#5a440e" : "#27272a";
                const countBg = isTop3 ? "#2a1f05" : "#27272a";
                const countColor = isTop3 ? "#f5c842" : "#d4d4d8";

                return (
                  <div
                    key={e.username}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5"
                    style={{ background: rowBg, border: `1px solid ${rowBorder}` }}
                  >
                    {/* Position */}
                    <div className="w-8 text-center flex-shrink-0">
                      {medal ? (
                        <span className="text-xl leading-none">{medal}</span>
                      ) : (
                        <span className="text-sm font-bold" style={{ color: "#71717a" }}>{i + 1}º</span>
                      )}
                    </div>

                    {/* Username */}
                    <div className="flex-1 min-w-0">
                      <span
                        className={`font-semibold truncate block ${isTop3 ? "text-sm" : "text-xs"}`}
                        style={{ color: "#f5f5f5" }}
                      >
                        @{e.username}
                      </span>
                    </div>

                    {/* Comments count */}
                    <div
                      className="flex-shrink-0 rounded-md px-2.5 py-1 text-center min-w-[52px]"
                      style={{ background: countBg, color: countColor }}
                    >
                      <span className={`font-bold ${isTop3 ? "text-sm" : "text-xs"}`}>{e.comments}</span>
                      <span className="text-[10px] ml-0.5">💬</span>
                    </div>

                    {/* Time ago */}
                    <div className="flex-shrink-0 w-24 text-right">
                      <span className="text-[10px] leading-tight" style={{ color: "#9ca3af" }}>
                        {e.lastInteraction
                          ? formatDistanceToNow(new Date(e.lastInteraction), { addSuffix: true, locale: ptBR })
                          : "—"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* KPIs Gerais */}
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pl-1">
        Visão Geral (últimos 30 dias)
      </div>
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpis.map(s => (
          <Card key={s.label}>
            <CardContent className="p-3 flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-muted ${s.color}`}>
                <s.icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-lg font-bold">{s.value}</p>
                <p className="text-[10px] text-muted-foreground leading-tight">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {!hasInsights && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription className="text-xs">
            Para ver alcance, compartilhamentos e salvamentos, seu perfil precisa ser <strong>Conta Profissional</strong> (Business ou Creator) no Instagram e o app Meta precisa ter permissão <strong>instagram_manage_insights</strong>.
          </AlertDescription>
        </Alert>
      )}

      {capabilities?.commentsPermissionMissing && (
        <Alert variant="destructive">
          <Info className="h-4 w-4" />
          <AlertDescription className="text-xs">
            <strong>Comentários não estão sendo capturados.</strong> Seus posts têm{" "}
            <strong>{capabilities.totalCommentsExpected} comentários</strong>, mas a API do Instagram retornou vazio.
            Isso significa que o token atual <strong>não possui a permissão <code>instagram_business_manage_comments</code></strong>.
            <br /><br />
            <strong>Como resolver:</strong> Acesse{" "}
            <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener noreferrer" className="underline font-semibold">
              developers.facebook.com/apps
            </a>
            {" "}→ seu app → <em>Instagram → API setup with Instagram login → Business Login Settings</em>,
            adicione o escopo <code>instagram_business_manage_comments</code>, gere um novo token longo
            com essa permissão e atualize o secret <code>INSTAGRAM_ACCESS_TOKEN</code>.
          </AlertDescription>
        </Alert>
      )}

      {/* TRACKED FOLLOWERS - Main feature */}
      <Card className="border-primary/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Search className="h-4 w-4 text-primary" /> Monitoramento de Seguidores
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Adicione o @ de um seguidor e registre manualmente suas interações. Clique no seguidor para expandir os detalhes.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="@username do seguidor"
              value={newUsername}
              onChange={e => setNewUsername(e.target.value)}
              className="flex-1 h-9"
              onKeyDown={e => { if (e.key === "Enter" && newUsername.trim()) addTrackedUser.mutate(newUsername); }}
            />
            <Button
              size="sm"
              onClick={() => addTrackedUser.mutate(newUsername)}
              disabled={!newUsername.trim() || addTrackedUser.isPending}
            >
              <UserPlus className="h-4 w-4 mr-1" />
              Monitorar
            </Button>
          </div>

          {!hasCommentsApi && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs">
                O monitoramento automático de comentários não está disponível com o token atual. Use os botões <strong>+ Interação</strong> abaixo para registrar manualmente quando um seguidor interagir com seus posts.
              </AlertDescription>
            </Alert>
          )}

          {enrichedTracked.length > 0 ? (
            <div className="space-y-2">
              {enrichedTracked.map((t: any) => {
                const isExpanded = expandedUser === t.id;
                return (
                  <Card key={t.id} className="overflow-hidden">
                    <div
                      className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => setExpandedUser(isExpanded ? null : t.id)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <a
                            href={`https://instagram.com/${t.username}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-primary hover:underline text-sm"
                            onClick={e => e.stopPropagation()}
                          >
                            @{t.username}
                          </a>
                          {getStatusBadge(t.liveFrequency || t.frequencia_interacao, t.liveComments)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {t.liveComments > 0
                            ? `${t.liveComments} interação(ões) registrada(s)`
                            : "Nenhuma interação registrada ainda"}
                          {t.liveLastInteraction && (
                            <> · última {formatDistanceToNow(new Date(t.liveLastInteraction), { addSuffix: true, locale: ptBR })}</>
                          )}
                        </p>
                      </div>
                      
                      {/* Manual interaction buttons */}
                      <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-7 w-7 text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-700"
                          title="Registrar interação"
                          onClick={() => {
                            const newCount = (t.liveComments || 0) + 1;
                            const freq = newCount >= 5 ? "alta" : newCount >= 2 ? "média" : "baixa";
                            updateEngagerStatus.mutate({ id: t.id, status: freq, comments: newCount });
                            toast.success(`+1 interação registrada para @${t.username}`);
                          }}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                        {t.liveComments > 0 && (
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-7 w-7 text-orange-600 hover:bg-orange-500/10 hover:text-orange-700"
                            title="Remover interação"
                            onClick={() => {
                              const newCount = Math.max(0, (t.liveComments || 0) - 1);
                              const freq = newCount >= 5 ? "alta" : newCount >= 2 ? "média" : newCount >= 1 ? "baixa" : "pendente";
                              updateEngagerStatus.mutate({ id: t.id, status: freq, comments: newCount });
                              toast.info(`-1 interação para @${t.username}`);
                            }}
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>

                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                        onClick={e => { e.stopPropagation(); removeTrackedUser.mutate(t.id); }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                      {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
                    </div>

                    {isExpanded && (
                      <div className="border-t bg-muted/30 px-3 py-3 space-y-3">
                        {t.interactions && t.interactions.length > 0 ? (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                              <MessageSquare className="h-3.5 w-3.5 text-blue-500" />
                              {t.interactions.length} interação(ões) de @{t.username}:
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                              {t.interactions.map((interaction: any, idx: number) => {
                                const thumb = interaction.postThumbnailUrl || interaction.postMediaUrl;
                                const isVideo = interaction.postMediaType === "VIDEO" || interaction.postMediaType === "REEL";
                                return (
                                  <a
                                    key={idx}
                                    href={interaction.postPermalink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={e => e.stopPropagation()}
                                    className="group block bg-background rounded-lg border hover:border-primary hover:shadow-sm transition-all overflow-hidden"
                                  >
                                    <div className="flex gap-2 p-2">
                                      {/* Post thumbnail */}
                                      <div className="relative w-16 h-16 shrink-0 rounded overflow-hidden bg-muted">
                                        {thumb ? (
                                          <img
                                            src={thumb}
                                            alt="Post"
                                            className="w-full h-full object-cover"
                                            loading="lazy"
                                            onError={(e) => {
                                              (e.target as HTMLImageElement).style.display = "none";
                                            }}
                                          />
                                        ) : (
                                          <div className="w-full h-full flex items-center justify-center text-[9px] text-muted-foreground">
                                            sem<br />imagem
                                          </div>
                                        )}
                                        {isVideo && (
                                          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                            <Play className="h-5 w-5 text-white fill-white" />
                                          </div>
                                        )}
                                      </div>
                                      {/* Comment + meta */}
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-1 mb-1">
                                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-blue-500/5 text-blue-600 border-blue-200">
                                            💬 Comentário
                                          </Badge>
                                          <ExternalLink className="h-3 w-3 text-muted-foreground group-hover:text-primary shrink-0" />
                                        </div>
                                        <p className="text-xs font-medium text-foreground line-clamp-2 leading-snug">
                                          "{interaction.commentText}"
                                        </p>
                                        {interaction.timestamp && (
                                          <p className="text-[10px] text-muted-foreground/70 mt-1">
                                            🕒 {formatDistanceToNow(new Date(interaction.timestamp), { addSuffix: true, locale: ptBR })}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                    {interaction.postCaption && (
                                      <p className="text-[10px] text-muted-foreground border-t border-dashed px-2 py-1.5 bg-muted/30 line-clamp-1">
                                        📌 {interaction.postCaption.slice(0, 60)}
                                      </p>
                                    )}
                                  </a>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-3 space-y-2">
                            <p className="text-xs text-muted-foreground">
                              {t.liveComments > 0
                                ? `${t.liveComments} interação(ões) registrada(s) manualmente.`
                                : "Nenhuma interação registrada ainda."}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              Use o botão <strong>+</strong> para registrar quando este seguidor curtir, comentar ou compartilhar seus posts.
                            </p>
                          </div>
                        )}

                        {/* Quick status selector */}
                        <div className="flex flex-wrap items-center gap-2 pt-2 border-t">
                          <span className="text-[10px] text-muted-foreground font-medium">Status manual:</span>
                          {[
                            { value: "alta", label: "🟢 Muito ativo", min: 5 },
                            { value: "média", label: "🔵 Ativo", min: 2 },
                            { value: "baixa", label: "🟡 Pouco ativo", min: 1 },
                            { value: "pendente", label: "⚪ Pendente", min: 0 },
                          ].map(opt => (
                            <Button
                              key={opt.value}
                              size="sm"
                              variant={(t.liveFrequency || t.frequencia_interacao) === opt.value ? "default" : "outline"}
                              className="h-6 text-[10px] px-2"
                              onClick={e => {
                                e.stopPropagation();
                                updateEngagerStatus.mutate({
                                  id: t.id,
                                  status: opt.value,
                                  comments: Math.max(t.liveComments || 0, opt.min),
                                });
                                toast.success(`Status de @${t.username} atualizado para "${opt.label}"`);
                              }}
                            >
                              {opt.label}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          ) : (
            <p className="text-center text-sm text-muted-foreground py-4">
              Nenhum seguidor monitorado ainda. Adicione o @ acima para começar a registrar interações.
            </p>
          )}
        </CardContent>
      </Card>

      {/* RECENT POSTS WITH ENGAGEMENT */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            📊 Engajamento por Publicação
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Curtidas e comentários de cada post
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Thumb</TableHead>
                <TableHead>Post</TableHead>
                <TableHead className="text-center">Tipo</TableHead>
                <TableHead className="text-right">❤️ Curtidas</TableHead>
                <TableHead className="text-right">💬 Coments</TableHead>
                {hasInsights && <TableHead className="text-right">🔄 Shares</TableHead>}
                {hasInsights && <TableHead className="text-right">👁️ Alcance</TableHead>}
                <TableHead className="w-8"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(recentPosts || []).map((post: any) => (
                <TableRow key={post.id}>
                  <TableCell>
                    <div className="w-12 h-12 rounded overflow-hidden bg-muted">
                      {(post.media_type === "VIDEO" || post.media_type === "REEL") && post.thumbnail_url ? (
                        <img src={post.thumbnail_url} alt="" className="w-full h-full object-cover" />
                      ) : post.media_url ? (
                        <img src={post.media_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[8px] text-muted-foreground">—</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <p className="text-xs text-muted-foreground line-clamp-2 max-w-[180px]">
                      {post.caption?.slice(0, 60) || "Sem legenda"}
                    </p>
                    {post.timestamp && (
                      <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                        {formatDistanceToNow(new Date(post.timestamp), { addSuffix: true, locale: ptBR })}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className="text-[9px]">{mediaTypeLabel(post.media_type)}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-bold text-red-600">{formatNum(post.like_count)}</TableCell>
                  <TableCell className="text-right font-bold text-blue-600">{formatNum(post.comments_count)}</TableCell>
                  {hasInsights && <TableCell className="text-right font-medium">{formatNum(post.insights?.shares)}</TableCell>}
                  {hasInsights && <TableCell className="text-right font-medium">{formatNum(post.insights?.reach)}</TableCell>}
                  <TableCell>
                    <a href={post.permalink} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                    </a>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Type breakdown */}
      {typeBreakdown && Object.keys(typeBreakdown).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4" /> Desempenho por Tipo de Conteúdo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Curtidas</TableHead>
                  <TableHead className="text-right">Comentários</TableHead>
                  <TableHead className="text-right">Média Curtidas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(typeBreakdown).map(([type, d]: [string, any]) => (
                  <TableRow key={type}>
                    <TableCell className="font-medium">{mediaTypeLabel(type)}</TableCell>
                    <TableCell className="text-right">{d.count}</TableCell>
                    <TableCell className="text-right">{formatNum(d.likes)}</TableCell>
                    <TableCell className="text-right">{formatNum(d.comments)}</TableCell>
                    <TableCell className="text-right">{d.count > 0 ? Math.round(d.likes / d.count) : 0}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Rankings tabs */}
      <Tabs defaultValue="likes">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="likes">❤️ Mais Curtidos</TabsTrigger>
          <TabsTrigger value="comments">💬 Mais Comentados</TabsTrigger>
          {hasCommentsApi && <TabsTrigger value="engagers">🏆 Top Interagentes</TabsTrigger>}
          {hasInsights && <TabsTrigger value="reach">👁️ Maior Alcance</TabsTrigger>}
          {hasInsights && <TabsTrigger value="shares">🔄 Mais Compartilhados</TabsTrigger>}
        </TabsList>

        <TabsContent value="likes"><PostRanking posts={bestByLikes} metric="likes" hasInsights={hasInsights} /></TabsContent>
        <TabsContent value="comments"><PostRanking posts={bestByComments} metric="comments" hasInsights={hasInsights} /></TabsContent>
        {hasCommentsApi && (
          <TabsContent value="engagers"><EngagersList engagers={topEngagers} onTrack={(username) => addTrackedUser.mutate(username)} trackedUsernames={trackedUsers.map((t: any) => t.username)} /></TabsContent>
        )}
        {hasInsights && <TabsContent value="reach"><PostRanking posts={bestByReach} metric="reach" hasInsights={hasInsights} /></TabsContent>}
        {hasInsights && <TabsContent value="shares"><PostRanking posts={bestByShares} metric="shares" hasInsights={hasInsights} /></TabsContent>}
      </Tabs>
    </div>
  );
}

function PostRanking({ posts, metric, hasInsights }: { posts: any[]; metric: string; hasInsights: boolean }) {
  if (!posts?.length) {
    return <Card><CardContent className="py-8 text-center text-muted-foreground">Sem dados disponíveis.</CardContent></Card>;
  }

  return (
    <Card className="mt-3">
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead>Post</TableHead>
              <TableHead className="text-right">❤️</TableHead>
              <TableHead className="text-right">💬</TableHead>
              {hasInsights && <TableHead className="text-right">👁️ Alcance</TableHead>}
              {hasInsights && <TableHead className="text-right">🔄 Shares</TableHead>}
              {hasInsights && <TableHead className="text-right">🔖 Saves</TableHead>}
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {posts.map((p: any, i: number) => (
              <TableRow key={p.id}>
                <TableCell className="font-bold">
                  {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                </TableCell>
                <TableCell>
                  <div className="max-w-[200px]">
                    <Badge variant="outline" className="text-[10px] mb-1">{mediaTypeLabel(p.media_type)}</Badge>
                    <p className="text-xs text-muted-foreground line-clamp-2">{p.caption?.slice(0, 80) || "Sem legenda"}</p>
                    {p.timestamp && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {formatDistanceToNow(new Date(p.timestamp), { addSuffix: true, locale: ptBR })}
                      </p>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right font-bold text-red-600">{formatNum(p.like_count)}</TableCell>
                <TableCell className="text-right font-bold text-blue-600">{formatNum(p.comments_count)}</TableCell>
                {hasInsights && <TableCell className="text-right font-medium">{formatNum(p.insights?.reach)}</TableCell>}
                {hasInsights && <TableCell className="text-right font-medium">{formatNum(p.insights?.shares)}</TableCell>}
                {hasInsights && <TableCell className="text-right font-medium">{formatNum(p.insights?.saved)}</TableCell>}
                <TableCell>
                  <a href={p.permalink} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                  </a>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function EngagersList({ engagers, onTrack, trackedUsernames }: { engagers: any[]; onTrack: (username: string) => void; trackedUsernames: string[] }) {
  if (!engagers?.length) {
    return (
      <Card className="mt-3">
        <CardContent className="py-8 text-center text-muted-foreground">
          Nenhum interagente encontrado nos últimos posts.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-3">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Award className="h-4 w-4" /> Pessoas que mais interagem com seu perfil
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead>Usuário</TableHead>
              <TableHead className="text-right">Comentários</TableHead>
              <TableHead className="text-right">Última Interação</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {engagers.map((e: any, i: number) => {
              const isTracked = trackedUsernames.some(t => t.toLowerCase() === e.username.toLowerCase());
              return (
                <TableRow key={e.username}>
                  <TableCell className="font-bold">
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                  </TableCell>
                  <TableCell>
                    <a href={`https://instagram.com/${e.username}`} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">
                      @{e.username}
                    </a>
                    {isTracked && <Badge className="ml-2 bg-emerald-500/10 text-emerald-600 border-emerald-200 text-[9px]">Monitorado</Badge>}
                  </TableCell>
                  <TableCell className="text-right font-bold">{e.comments}</TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {e.lastInteraction ? formatDistanceToNow(new Date(e.lastInteraction), { addSuffix: true, locale: ptBR }) : "—"}
                  </TableCell>
                  <TableCell>
                    {!isTracked && (
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onTrack(e.username)}>
                        <UserPlus className="h-3.5 w-3.5 text-primary" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
