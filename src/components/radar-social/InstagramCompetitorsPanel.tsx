import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DeleteConfirmDialog } from "@/components/logistics/DeleteConfirmDialog";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  Trophy, TrendingUp, TrendingDown, Heart, MessageCircle, Users, RefreshCw, Plus, Trash2,
  ExternalLink, Sparkles, Image as ImageIcon, Loader2, Target, Zap, Calendar, BarChart3, Video, Images, Minus,
} from "lucide-react";

type Competitor = {
  id: string;
  username: string;
  display_name: string | null;
  partido: string | null;
  cargo: string | null;
  observacoes: string | null;
  ativo: boolean;
};

type Snapshot = {
  competitor_id: string;
  snapshot_date: string;
  followers: number;
  follows: number;
  media_count: number;
  total_likes: number;
  total_comments: number;
  avg_engagement: number;
  top_posts: any[];
  themes: any[];
  profile_picture_url: string | null;
  biography: string | null;
};

function nf(n: number) { return n.toLocaleString("pt-BR"); }

export function InstagramCompetitorsPanel() {
  const { userRole, isSuperAdmin } = useAuth();
  const isAdmin = isSuperAdmin || userRole === "admin";
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ username: "", display_name: "", partido: "", cargo: "", observacoes: "" });

  const AUTO_MS = 1000 * 60 * 10; // 10 minutos

  const { data: competitors = [], isLoading: loadingComp } = useQuery({
    queryKey: ["social_competitors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("social_competitors" as any)
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as Competitor[];
    },
    refetchInterval: AUTO_MS,
    refetchIntervalInBackground: true,
  });

  const { data: snapshots = [] } = useQuery({
    queryKey: ["social_competitor_snapshots"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("social_competitor_snapshots" as any)
        .select("*")
        .order("snapshot_date", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Snapshot[];
    },
    refetchInterval: AUTO_MS,
    refetchIntervalInBackground: true,
  });

  // Meu perfil — histórico diário do Instagram (perfil próprio)
  const { data: myHistory = [] } = useQuery({
    queryKey: ["my_instagram_history"],
    queryFn: async () => {
      const { data } = await supabase
        .from("instagram_daily_snapshots" as any)
        .select("*")
        .order("snapshot_date", { ascending: true });
      return (data || []) as any[];
    },
    refetchInterval: AUTO_MS,
    refetchIntervalInBackground: true,
  });
  const myProfile = myHistory.length > 0 ? myHistory[myHistory.length - 1] : null;

  // Latest snapshot per competitor
  const latestByCompetitor: Record<string, Snapshot> = {};
  for (const s of snapshots) {
    if (!latestByCompetitor[s.competitor_id]) latestByCompetitor[s.competitor_id] = s;
  }

  const ranking = competitors
    .map((c) => ({ c, s: latestByCompetitor[c.id] }))
    .filter((x) => x.s)
    .sort((a, b) => (b.s!.avg_engagement || 0) - (a.s!.avg_engagement || 0));

  const allPosts = competitors
    .flatMap((c) => {
      const s = latestByCompetitor[c.id];
      if (!s) return [];
      return (s.top_posts || []).map((p: any) => ({ ...p, _comp: c }));
    })
    .sort((a, b) => (b.likeCount + b.commentsCount) - (a.likeCount + a.commentsCount))
    .slice(0, 12);

  const themeAggregated: Record<string, number> = {};
  for (const c of competitors) {
    const s = latestByCompetitor[c.id];
    if (!s) continue;
    for (const t of s.themes || []) {
      const k = String(t.tema || "").trim().toLowerCase();
      if (!k) continue;
      themeAggregated[k] = (themeAggregated[k] || 0) + Number(t.mencoes || 1);
    }
  }
  const themesSorted = Object.entries(themeAggregated)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);

  // Growth chart data: followers timeline per competitor
  const growthByComp: Record<string, { date: string; followers: number }[]> = {};
  for (const s of snapshots) {
    if (!growthByComp[s.competitor_id]) growthByComp[s.competitor_id] = [];
    growthByComp[s.competitor_id].push({ date: s.snapshot_date, followers: s.followers });
  }
  Object.values(growthByComp).forEach((arr) => arr.sort((a, b) => a.date.localeCompare(b.date)));

  const addMutation = useMutation({
    mutationFn: async () => {
      const username = form.username.trim().replace(/^@/, "").toLowerCase();
      if (!username) throw new Error("Username obrigatório");
      const { data, error } = await supabase.from("social_competitors" as any).insert({
        username,
        display_name: form.display_name.trim() || null,
        partido: form.partido.trim() || null,
        cargo: form.cargo.trim() || null,
        observacoes: form.observacoes.trim() || null,
      }).select("id").single();
      if (error) throw error;
      return (data as any)?.id as string;
    },
    onSuccess: async (id) => {
      toast.success("Concorrente adicionado — coletando dados...");
      setOpen(false);
      setForm({ username: "", display_name: "", partido: "", cargo: "", observacoes: "" });
      qc.invalidateQueries({ queryKey: ["social_competitors"] });
      try {
        const { data: res } = await supabase.functions.invoke("instagram-competitors", {
          body: id ? { action: "refresh_one", competitor_id: id } : { action: "snapshot_all" },
        });
        if (res?.success === false) {
          toast.error(res.error || "Não foi possível coletar os dados do perfil");
        } else if (res?.errors?.length) {
          toast.warning(res.errors[0]?.error || "Perfil privado ou não Business/Creator");
        } else {
          toast.success("Dados coletados");
        }
      } catch (e: any) {
        toast.error(e.message || "Erro ao coletar dados do perfil");
      }
      qc.invalidateQueries({ queryKey: ["social_competitor_snapshots"] });
    },
    onError: (e: any) => toast.error(e.message || "Erro ao adicionar"),
  });


  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("social_competitors" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Removido");
      qc.invalidateQueries({ queryKey: ["social_competitors"] });
      qc.invalidateQueries({ queryKey: ["social_competitor_snapshots"] });
    },
    onError: (e: any) => toast.error(e.message || "Erro ao remover"),
  });

  async function handleRefreshAll() {
    setRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke("instagram-competitors", {
        body: { action: "snapshot_all" },
      });
      if (error) throw error;
      if (data?.success === false) {
        toast.error(data.error || "Falha ao coletar");
      } else {
        toast.success(`Coletados ${data?.processed || 0} perfis`);
        if (data?.errors?.length) {
          toast.warning(`${data.errors.length} perfis com erro (perfil privado ou não-Business)`);
        }
      }
      qc.invalidateQueries({ queryKey: ["social_competitor_snapshots"] });
      qc.invalidateQueries({ queryKey: ["social_competitors"] });
    } catch (e: any) {
      toast.error(e.message || "Erro ao coletar");
    } finally {
      setRefreshing(false);
    }
  }

  // Auto-coleta a cada 10 min (mesmo padrão do Insights)
  const lastAutoRun = useRef<number>(0);
  useEffect(() => {
    if (competitors.length === 0) return;
    const tick = async () => {
      const now = Date.now();
      if (now - lastAutoRun.current < AUTO_MS - 5000) return;
      lastAutoRun.current = now;
      try {
        await supabase.functions.invoke("instagram-competitors", { body: { action: "snapshot_all" } });
        qc.invalidateQueries({ queryKey: ["social_competitor_snapshots"] });
      } catch (_) { /* silencioso */ }
    };
    const id = setInterval(tick, AUTO_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [competitors.length]);


  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-primary" /> Comparativo de Concorrentes
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Monitore engajamento, posts e temas dos seus adversários no Instagram. Requer perfis Business/Creator (Business Discovery API).
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleRefreshAll} disabled={refreshing || competitors.length === 0}>
                {refreshing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                Atualizar agora
              </Button>
              {isAdmin && (
                <Dialog open={open} onOpenChange={setOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline"><Plus className="h-4 w-4 mr-2" /> Adicionar</Button>
                  </DialogTrigger>
                  <DialogContent className="max-h-[90vh] overflow-y-auto">
                    <DialogHeader><DialogTitle>Adicionar concorrente</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                      <div>
                        <Label>Username Instagram (sem @)</Label>
                        <Input
                          autoComplete="off"
                          placeholder="ex: lulaoficial"
                          value={form.username}
                          onChange={(e) => setForm({ ...form, username: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Nome do candidato</Label>
                        <Input
                          value={form.display_name}
                          onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>Partido</Label>
                          <Input value={form.partido} onChange={(e) => setForm({ ...form, partido: e.target.value })} />
                        </div>
                        <div>
                          <Label>Cargo</Label>
                          <Input value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} />
                        </div>
                      </div>
                      <div>
                        <Label>Observações</Label>
                        <Textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                      <Button onClick={() => addMutation.mutate()} disabled={addMutation.isPending}>
                        {addMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Adicionar
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {loadingComp ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">Carregando...</CardContent></Card>
      ) : competitors.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">
          Nenhum concorrente cadastrado. {isAdmin && "Clique em Adicionar para começar."}
        </CardContent></Card>
      ) : (
        <Tabs defaultValue="vs">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="vs"><Target className="h-4 w-4 mr-1" /> vs Meu Perfil</TabsTrigger>
            <TabsTrigger value="ranking"><TrendingUp className="h-4 w-4 mr-1" /> Ranking</TabsTrigger>
            <TabsTrigger value="posts"><Heart className="h-4 w-4 mr-1" /> Top Posts</TabsTrigger>
            <TabsTrigger value="temas"><Sparkles className="h-4 w-4 mr-1" /> Temas</TabsTrigger>
            <TabsTrigger value="crescimento"><Users className="h-4 w-4 mr-1" /> Crescimento</TabsTrigger>
            <TabsTrigger value="lista">Lista</TabsTrigger>
          </TabsList>

          <TabsContent value="vs" className="mt-4">
            <VsMeuPerfilTab competitors={competitors} latestByCompetitor={latestByCompetitor} growthByComp={growthByComp} myProfile={myProfile} />
          </TabsContent>


          <TabsContent value="ranking" className="mt-4">
            <Card>
              <CardHeader><CardTitle>Ranking de Engajamento</CardTitle></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Candidato</TableHead>
                      <TableHead className="text-right">Seguidores</TableHead>
                      <TableHead className="text-right">Posts</TableHead>
                      <TableHead className="text-right">Curtidas</TableHead>
                      <TableHead className="text-right">Comentários</TableHead>
                      <TableHead className="text-right">Engaj. médio</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ranking.length === 0 && (
                      <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                        Clique em "Atualizar agora" para coletar dados.
                      </TableCell></TableRow>
                    )}
                    {ranking.map((row, i) => (
                      <TableRow key={row.c.id}>
                        <TableCell className="font-bold">
                          {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {row.s?.profile_picture_url ? (
                              <img src={row.s.profile_picture_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-muted" />
                            )}
                            <div>
                              <div className="font-medium">{row.c.display_name || row.c.username}</div>
                              <div className="text-xs text-muted-foreground">@{row.c.username} {row.c.partido && `· ${row.c.partido}`}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{nf(row.s!.followers)}</TableCell>
                        <TableCell className="text-right">{nf(row.s!.media_count)}</TableCell>
                        <TableCell className="text-right">{nf(row.s!.total_likes)}</TableCell>
                        <TableCell className="text-right">{nf(row.s!.total_comments)}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={i === 0 ? "default" : "secondary"}>{row.s!.avg_engagement}%</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="posts" className="mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {allPosts.length === 0 && (
                <Card className="sm:col-span-2 lg:col-span-3">
                  <CardContent className="py-10 text-center text-muted-foreground">Sem posts ainda. Atualize os dados.</CardContent>
                </Card>
              )}
              {allPosts.map((p) => (
                <Card key={p.id} className="overflow-hidden">
                  <div className="aspect-square bg-muted relative">
                    {p.thumbnailUrl || p.mediaUrl ? (
                      <img src={p.thumbnailUrl || p.mediaUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><ImageIcon className="h-8 w-8 text-muted-foreground" /></div>
                    )}
                    <Badge className="absolute top-2 left-2">{p._comp.display_name || p._comp.username}</Badge>
                  </div>
                  <CardContent className="p-3 space-y-2">
                    <p className="text-xs line-clamp-2 text-muted-foreground">{p.caption}</p>
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1"><Heart className="h-3 w-3" /> {nf(p.likeCount)}</span>
                      <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" /> {nf(p.commentsCount)}</span>
                      {p.permalink && (
                        <a href={p.permalink} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3 w-3 text-primary" />
                        </a>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="temas" className="mt-4">
            <Card>
              <CardHeader><CardTitle>Temas mais abordados pelos concorrentes</CardTitle></CardHeader>
              <CardContent>
                {themesSorted.length === 0 ? (
                  <p className="text-center text-muted-foreground py-6">Sem dados ainda.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {themesSorted.map(([tema, count]) => (
                      <Badge key={tema} variant="secondary" className="text-sm py-2 px-3">
                        {tema} <span className="ml-2 opacity-70">×{count}</span>
                      </Badge>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-4">
                  Análise por IA com base nas legendas dos últimos 25 posts de cada perfil.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="crescimento" className="mt-4">
            <CrescimentoTab competitors={competitors} growthByComp={growthByComp} myHistory={myHistory} />
          </TabsContent>


          <TabsContent value="lista" className="mt-4">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Perfil</TableHead>
                      <TableHead>Partido</TableHead>
                      <TableHead>Cargo</TableHead>
                      {isAdmin && <TableHead className="w-20">Ações</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {competitors.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>
                          <div className="font-medium">{c.display_name || c.username}</div>
                          <div className="text-xs text-muted-foreground">@{c.username}</div>
                        </TableCell>
                        <TableCell>{c.partido || "—"}</TableCell>
                        <TableCell>{c.cargo || "—"}</TableCell>
                        {isAdmin && (
                          <TableCell>
                            <DeleteConfirmDialog
                              title="Remover concorrente?"
                              description={`Isso apagará ${c.username} e todo seu histórico.`}
                              onConfirm={() => deleteMutation.mutate(c.id)}
                              trigger={
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              }
                            />
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

// ============================================================================
// Aba "vs Meu Perfil" — comparativos detalhados por concorrente
// ============================================================================

function Delta({ mine, theirs, suffix = "", invert = false }: { mine: number; theirs: number; suffix?: string; invert?: boolean }) {
  if (!mine && !theirs) return <span className="text-xs text-muted-foreground">—</span>;
  const diff = theirs - mine;
  const pct = mine > 0 ? ((diff / mine) * 100) : 0;
  // invert=true → menor é melhor para mim (ex: eles têm menos). Default: theirs > mine = eles ganham (vermelho para mim)
  const theyWin = invert ? diff < 0 : diff > 0;
  const tied = Math.abs(pct) < 1;
  const color = tied ? "text-muted-foreground" : theyWin ? "text-red-600" : "text-green-600";
  const Icon = tied ? Minus : theyWin ? TrendingUp : TrendingDown;
  const label = tied ? "≈ você" : theyWin ? `+${Math.abs(pct).toFixed(0)}% vs você` : `-${Math.abs(pct).toFixed(0)}% vs você`;
  return (
    <span className={`text-xs flex items-center gap-1 ${color}`}>
      <Icon className="h-3 w-3" /> {label}{suffix}
    </span>
  );
}

function Metric({ icon: Icon, label, value, sub, hint }: any) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="text-lg font-bold leading-tight">{value}</div>
      {sub && <div className="mt-1">{sub}</div>}
      {hint && <div className="text-[10px] text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}

function BaselineCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider font-bold opacity-70 mb-0.5">{label}</p>
      <p className="text-base font-bold leading-tight">{value}</p>
    </div>
  );
}

function RowMetric({ label, value, delta, hint }: { label: string; value: string; delta?: React.ReactNode; hint?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-0.5">{label}</p>
      <p className="text-sm font-bold leading-tight truncate">{value}</p>
      {delta && <div className="mt-0.5">{delta}</div>}
      {hint && !delta && <p className="text-[10px] text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  );
}

function VsMeuPerfilTab({ competitors, latestByCompetitor, growthByComp, myProfile }: any) {
  const fmt = (n: number) => (n || 0).toLocaleString("pt-BR");

  const me = {
    followers: Number(myProfile?.followers || 0),
    media_count: Number(myProfile?.media_count || 0),
    total_likes: Number(myProfile?.total_likes || 0),
    total_comments: Number(myProfile?.total_comments || 0),
    avg_engagement: Number(myProfile?.avg_engagement || 0),
  };
  const meAvgLikes = me.media_count > 0 ? me.total_likes / Math.min(me.media_count, 25) : 0;
  const meAvgComments = me.media_count > 0 ? me.total_comments / Math.min(me.media_count, 25) : 0;
  const meRatio = meAvgComments > 0 ? meAvgLikes / meAvgComments : 0;

  if (!myProfile) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Para ver o comparativo "vs Meu Perfil", colete primeiro os dados do seu Instagram na aba <strong>Instagram — Relatório</strong>.
        </CardContent>
      </Card>
    );
  }

  const withData = competitors.filter((c: any) => latestByCompetitor[c.id]);

  if (withData.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Sem dados de concorrentes ainda. Clique em "Atualizar agora".
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {/* Linha de base — sticky no topo */}
      <div className="sticky top-2 z-10 rounded-xl bg-primary text-primary-foreground shadow-lg ring-1 ring-primary/40">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3 p-4">
          <div className="flex items-center gap-3 lg:w-64 shrink-0">
            <div className="h-10 w-10 rounded-full bg-primary-foreground/10 ring-2 ring-primary-foreground/30 flex items-center justify-center">
              <Target className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider font-bold opacity-70">Sua linha de base</p>
              <p className="font-semibold text-sm truncate">Meu Perfil</p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 flex-1 gap-3">
            <BaselineCell label="Seguidores" value={fmt(me.followers)} />
            <BaselineCell label="Engaj. médio" value={`${me.avg_engagement.toFixed(2)}%`} />
            <BaselineCell label="Curtidas/post" value={fmt(Math.round(meAvgLikes))} />
            <BaselineCell label="Coment./post" value={fmt(Math.round(meAvgComments))} />
            <BaselineCell label="Posts" value={fmt(me.media_count)} />
          </div>
        </div>
      </div>

      {/* Linhas comparativas — uma por concorrente */}
      <div className="space-y-2">
        {withData.map((c: any) => {
          const s = latestByCompetitor[c.id];
          const postsAnalisados = Math.min(s.media_count, 25) || (s.top_posts?.length || 0) || 1;
          const avgLikes = s.total_likes / postsAnalisados;
          const avgComments = s.total_comments / postsAnalisados;
          const ratio = avgComments > 0 ? avgLikes / avgComments : 0;
          const reachPerPost = s.followers > 0 ? ((avgLikes + avgComments) / s.followers) * 100 : 0;
          const meReachPerPost = me.followers > 0 ? ((meAvgLikes + meAvgComments) / me.followers) * 100 : 0;

          const series = growthByComp[c.id] || [];
          let postsPerWeek = 0;
          if (series.length >= 2) {
            const firstDate = new Date(series[0].date);
            const lastDate = new Date(series[series.length - 1].date);
            const days = Math.max(1, (lastDate.getTime() - firstDate.getTime()) / 86400000);
            postsPerWeek = (s.media_count / Math.max(days, 7)) * 7;
          }
          const growthDiff = series.length >= 2 ? series[series.length - 1].followers - series[0].followers : 0;

          const types: Record<string, number> = {};
          for (const p of (s.top_posts || [])) {
            const t = (p.mediaType || "IMAGE").toUpperCase();
            types[t] = (types[t] || 0) + 1;
          }
          const totalTypes = Object.values(types).reduce((a, b) => a + b, 0) || 1;
          const videoPct = ((types["VIDEO"] || 0) / totalTypes) * 100;
          const carouselPct = ((types["CAROUSEL_ALBUM"] || 0) / totalTypes) * 100;
          const imagePct = 100 - videoPct - carouselPct;

          const bestPost = (s.top_posts || [])[0];
          const topTemas = (s.themes || []).slice(0, 3);

          const wins: string[] = [];
          const losses: string[] = [];
          if (s.avg_engagement > me.avg_engagement * 1.1) wins.push("engajamento");
          else if (s.avg_engagement < me.avg_engagement * 0.9) losses.push("engajamento");
          if (s.followers > me.followers * 1.1) wins.push("alcance");
          else if (s.followers < me.followers * 0.9) losses.push("alcance");
          if (avgComments > meAvgComments * 1.1) wins.push("conversa");
          else if (avgComments < meAvgComments * 0.9) losses.push("conversa");

          return (
            <Card key={c.id} className="overflow-hidden hover:border-primary/40 transition-colors">
              <div className="flex flex-col xl:flex-row">
                {/* Identidade */}
                <div className="xl:w-72 shrink-0 p-4 bg-muted/30 border-b xl:border-b-0 xl:border-r">
                  <div className="flex gap-3">
                    {s.profile_picture_url ? (
                      <img src={s.profile_picture_url} alt="" className="w-12 h-12 rounded-full object-cover border border-border shrink-0" />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-muted shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-sm truncate">{c.display_name || c.username}</div>
                      <div className="text-[11px] text-muted-foreground truncate">@{c.username}</div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {c.partido && <Badge variant="outline" className="text-[9px] px-1.5 py-0">{c.partido}</Badge>}
                        {c.cargo && <Badge variant="secondary" className="text-[9px] px-1.5 py-0">{c.cargo}</Badge>}
                      </div>
                    </div>
                  </div>
                  {(wins.length > 0 || losses.length > 0) && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {wins.map((w) => (
                        <span key={`w-${w}`} className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-destructive/10 text-destructive border border-destructive/20">
                          Ganha em {w}
                        </span>
                      ))}
                      {losses.map((l) => (
                        <span key={`l-${l}`} className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-success/10 text-success border border-success/20">
                          Você ganha em {l}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* KPIs principais */}
                <div className="flex-1 p-4 grid grid-cols-2 md:grid-cols-4 gap-3 border-b xl:border-b-0 xl:border-r">
                  <RowMetric label="Seguidores" value={fmt(s.followers)} delta={<Delta mine={me.followers} theirs={s.followers} />} />
                  <RowMetric label="Engaj. médio" value={`${s.avg_engagement}%`} delta={<Delta mine={me.avg_engagement} theirs={s.avg_engagement} />} />
                  <RowMetric label="Curtidas/post" value={fmt(Math.round(avgLikes))} delta={<Delta mine={meAvgLikes} theirs={avgLikes} />} />
                  <RowMetric label="Coment./post" value={fmt(Math.round(avgComments))} delta={<Delta mine={meAvgComments} theirs={avgComments} />} />
                  <RowMetric label="Alcance/post" value={`${reachPerPost.toFixed(2)}%`} delta={<Delta mine={meReachPerPost} theirs={reachPerPost} />} />
                  <RowMetric label="Razão L/C" value={ratio > 0 ? ratio.toFixed(1) : "—"} delta={<Delta mine={meRatio} theirs={ratio} invert />} hint="menor = mais debate" />
                  <RowMetric label="Posts/semana" value={postsPerWeek > 0 ? postsPerWeek.toFixed(1) : "—"} hint="cadência" />
                  <RowMetric label="Crescim." value={series.length >= 2 ? `${growthDiff >= 0 ? "+" : ""}${fmt(growthDiff)}` : "—"} hint="seguidores no período" />
                </div>

                {/* Estratégia: mix + temas + melhor post */}
                <div className="xl:w-96 shrink-0 p-4 bg-muted/20 space-y-3">
                  {totalTypes > 0 && (
                    <div>
                      <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1.5 flex items-center gap-1">
                        <Images className="h-3 w-3" /> Mix de conteúdo
                      </div>
                      <div className="flex h-1.5 rounded-full overflow-hidden bg-muted">
                        <div className="bg-pink-500" style={{ width: `${imagePct}%` }} title={`Imagens ${imagePct.toFixed(0)}%`} />
                        <div className="bg-purple-500" style={{ width: `${videoPct}%` }} title={`Reels/Vídeo ${videoPct.toFixed(0)}%`} />
                        <div className="bg-blue-500" style={{ width: `${carouselPct}%` }} title={`Carrossel ${carouselPct.toFixed(0)}%`} />
                      </div>
                      <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground mt-1">
                        <span><span className="inline-block w-1.5 h-1.5 rounded-full bg-pink-500 mr-1" />Img {imagePct.toFixed(0)}%</span>
                        <span><span className="inline-block w-1.5 h-1.5 rounded-full bg-purple-500 mr-1" />Reels {videoPct.toFixed(0)}%</span>
                        <span><span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 mr-1" />Carr. {carouselPct.toFixed(0)}%</span>
                      </div>
                    </div>
                  )}

                  {topTemas.length > 0 && (
                    <div>
                      <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1.5 flex items-center gap-1">
                        <Sparkles className="h-3 w-3" /> Top temas (IA)
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {topTemas.map((t: any, i: number) => (
                          <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0">{t.tema} ×{t.mencoes}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {bestPost && (
                    <div>
                      <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1.5 flex items-center gap-1">
                        <Trophy className="h-3 w-3" /> Melhor post
                      </div>
                      <a
                        href={bestPost.permalink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex gap-2 p-2 rounded-md border bg-card hover:bg-accent transition-colors"
                      >
                        {bestPost.thumbnailUrl || bestPost.mediaUrl ? (
                          <img src={bestPost.thumbnailUrl || bestPost.mediaUrl} alt="" className="w-10 h-10 rounded object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-10 h-10 rounded bg-muted flex items-center justify-center flex-shrink-0">
                            {bestPost.mediaType === "VIDEO" ? <Video className="h-4 w-4" /> : <ImageIcon className="h-4 w-4" />}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] line-clamp-2 leading-tight">{bestPost.caption || "(sem legenda)"}</p>
                          <div className="flex gap-2 text-[10px] text-muted-foreground mt-1">
                            <span className="flex items-center gap-0.5"><Heart className="h-2.5 w-2.5" /> {fmt(bestPost.likeCount)}</span>
                            <span className="flex items-center gap-0.5"><MessageCircle className="h-2.5 w-2.5" /> {fmt(bestPost.commentsCount)}</span>
                            <ExternalLink className="h-2.5 w-2.5 ml-auto" />
                          </div>
                        </div>
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// Aba "Crescimento" — Geral (período) + Diário, com meu perfil incluído
// ============================================================================

type GrowthEntry = { name: string; isMe: boolean; series: { date: string; followers: number }[] };

function CrescimentoTab({ competitors, growthByComp, myHistory }: any) {
  const fmt = (n: number) => (n || 0).toLocaleString("pt-BR");

  const entries: GrowthEntry[] = [];

  // Meu perfil
  const meSeries = (myHistory || [])
    .map((h: any) => ({ date: h.snapshot_date, followers: Number(h.followers || 0) }))
    .sort((a: any, b: any) => a.date.localeCompare(b.date));
  if (meSeries.length > 0) {
    entries.push({ name: "Meu perfil", isMe: true, series: meSeries });
  }

  // Concorrentes
  for (const c of competitors) {
    const s = growthByComp[c.id] || [];
    if (s.length > 0) entries.push({ name: c.display_name || c.username, isMe: false, series: s });
  }

  if (entries.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Sem histórico ainda. A coleta ocorre automaticamente a cada 10 min.
        </CardContent>
      </Card>
    );
  }

  // ---- GERAL (todo o período disponível) ----
  const geral = entries
    .map((e) => {
      const first = e.series[0].followers;
      const last = e.series[e.series.length - 1].followers;
      const diff = last - first;
      const pct = first > 0 ? (diff / first) * 100 : 0;
      return { ...e, first, last, diff, pct, days: e.series.length };
    })
    .sort((a, b) => b.diff - a.diff);

  const meTotal = geral.find((g) => g.isMe);

  // ---- DIÁRIO (último dia vs dia anterior) ----
  const diario = entries
    .map((e) => {
      const last = e.series[e.series.length - 1];
      const prev = e.series.length >= 2 ? e.series[e.series.length - 2] : null;
      const diff = prev ? last.followers - prev.followers : 0;
      const pct = prev && prev.followers > 0 ? (diff / prev.followers) * 100 : 0;
      return { ...e, last: last.followers, prev: prev?.followers ?? null, diff, pct, lastDate: last.date };
    })
    .sort((a, b) => b.diff - a.diff);

  const meDay = diario.find((d) => d.isMe);

  return (
    <Tabs defaultValue="geral">
      <TabsList>
        <TabsTrigger value="geral"><TrendingUp className="h-4 w-4 mr-1" /> Geral</TabsTrigger>
        <TabsTrigger value="diario"><Calendar className="h-4 w-4 mr-1" /> Diário</TabsTrigger>
      </TabsList>

      <TabsContent value="geral" className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Crescimento total no período</CardTitle>
            <p className="text-xs text-muted-foreground">
              Compara o ganho de seguidores acumulado desde a primeira coleta. Inclui o seu perfil.
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            {geral.map((g) => {
              const vsMe = meTotal && !g.isMe ? g.diff - meTotal.diff : null;
              return (
                <div
                  key={g.name}
                  className={`flex items-center justify-between rounded-md border p-3 ${g.isMe ? "border-primary/40 bg-primary/5" : ""}`}
                >
                  <div className="min-w-0">
                    <div className="font-medium flex items-center gap-2">
                      {g.name}
                      {g.isMe && <Badge variant="default" className="text-[10px]">você</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {g.days} coleta(s) · base {fmt(g.first)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-sm">{fmt(g.last)}</div>
                    <div className={`text-xs font-medium ${g.diff >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {g.diff >= 0 ? "+" : ""}{fmt(g.diff)} ({g.pct.toFixed(2)}%)
                    </div>
                    {vsMe !== null && (
                      <div className={`text-[10px] ${vsMe > 0 ? "text-red-600" : vsMe < 0 ? "text-green-600" : "text-muted-foreground"}`}>
                        {vsMe > 0 ? `+${fmt(vsMe)} acima de você` : vsMe < 0 ? `${fmt(vsMe)} abaixo de você` : "≈ você"}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="diario" className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Variação do último dia</CardTitle>
            <p className="text-xs text-muted-foreground">
              Diferença entre a coleta mais recente e a anterior. Comparado ao seu perfil.
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            {diario.map((d) => {
              const vsMe = meDay && !d.isMe ? d.diff - meDay.diff : null;
              return (
                <div
                  key={d.name}
                  className={`flex items-center justify-between rounded-md border p-3 ${d.isMe ? "border-primary/40 bg-primary/5" : ""}`}
                >
                  <div className="min-w-0">
                    <div className="font-medium flex items-center gap-2">
                      {d.name}
                      {d.isMe && <Badge variant="default" className="text-[10px]">você</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {d.prev !== null ? `${fmt(d.prev)} → ${fmt(d.last)}` : `sem dia anterior`} · {d.lastDate}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`font-mono text-sm ${d.diff > 0 ? "text-green-600" : d.diff < 0 ? "text-red-600" : "text-muted-foreground"}`}>
                      {d.diff > 0 ? "+" : ""}{fmt(d.diff)}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {d.prev ? `${d.pct.toFixed(2)}%` : "—"}
                    </div>
                    {vsMe !== null && (
                      <div className={`text-[10px] ${vsMe > 0 ? "text-red-600" : vsMe < 0 ? "text-green-600" : "text-muted-foreground"}`}>
                        {vsMe > 0 ? `+${fmt(vsMe)} vs você` : vsMe < 0 ? `${fmt(vsMe)} vs você` : "≈ você"}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {diario.every((d) => d.prev === null) && (
              <p className="text-center text-xs text-muted-foreground py-4">
                Precisa de pelo menos 2 dias de coleta para calcular variação diária.
              </p>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}


