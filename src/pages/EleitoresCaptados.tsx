import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEleitoresCaptados } from "@/hooks/useEleitoresCaptados";
import { useAuth } from "@/hooks/useAuth";
import { useCanSendWhatsApp, useUserPermissions } from "@/hooks/useUserPermissions";
import { useCoordenadores } from "@/hooks/useCoordenadores";
import { NativeSelect } from "@/components/ui/native-select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Trophy, Users, Vote, MapPin, Phone, Loader2, Search, MessageCircle, UserCheck, Download, Star, RotateCcw } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import EvolucaoCaptacaoChart from "@/components/EvolucaoCaptacaoChart";
import { LeadStatusControls, LeadObsBadge } from "@/components/LeadStatusControls";
import { toPng } from "html-to-image";
import { toast } from "@/hooks/use-toast";


function waLink(phone: string, name?: string) {
  const digits = phone.replace(/\D/g, "");
  const num = digits.startsWith("55") ? digits : `55${digits}`;
  const text = encodeURIComponent(`Olá${name ? `, ${name.split(" ")[0]}` : ""}!`);
  return `https://wa.me/${num}?text=${text}`;
}


interface RankingRow {
  user_id: string;
  nome: string;
  total: number;
}

export default function EleitoresCaptados() {
  const { userRole, session } = useAuth();
  const isCaptador = userRole === "operador_cadastro";
  const isAdmin = userRole === "admin";
  const canSendWhatsApp = useCanSendWhatsApp();
  const { data: permissions = [] } = useUserPermissions();
  const canRevertCaptacao = isAdmin || permissions.includes("leads_full");
  const currentUserId = session?.user?.id ?? null;
  const qc = useQueryClient();

  // Admin: visualizar a página como um coordenador específico
  const [viewAsId, setViewAsId] = useState<string>("");
  const viewAs = isAdmin && viewAsId ? viewAsId : null;
  const hasFullAccess = isAdmin && !viewAs;

  const { data: coordenadores = [] } = useCoordenadores();

  const { data: ranking = [], isLoading: lr } = useQuery({
    queryKey: ["captados-ranking", viewAs],
    enabled: !isCaptador,
    queryFn: async () => {
      const { data, error } = viewAs
        ? await supabase.rpc("get_captados_ranking_for" as never, { _user_id: viewAs } as never)
        : await supabase.rpc("get_captados_ranking" as never);
      if (error) throw error;
      return ((data || []) as unknown as RankingRow[]).map((r) => ({
        ...r,
        total: Number(r.total) || 0,
      }));
    },
  });

  const { data: totalGeralReal = 0 } = useQuery({
    queryKey: ["captados-total-real", viewAs],
    enabled: !isCaptador,
    queryFn: async () => {
      const { data, error } = viewAs
        ? await supabase.rpc("get_captados_total_for" as never, { _user_id: viewAs } as never)
        : await supabase.rpc("get_captados_total" as never);
      if (error) throw error;
      return Number(data) || 0;
    },
  });

  const { data: meuIndividualTotal = 0 } = useQuery({
    queryKey: ["captados-meu-individual", viewAs || currentUserId],
    enabled: !!(viewAs || currentUserId),
    queryFn: async () => {
      const uid = viewAs || currentUserId;
      if (!uid) return 0;
      const { count, error } = await supabase
        .from("eleitores_captados")
        .select("id", { count: "exact", head: true })
        .eq("captado_por_user_id", uid);

      if (error) throw error;
      return count ?? 0;
    },
  });


  const { data: rankingCoord = [], isLoading: lrc } = useQuery({
    queryKey: ["captados-ranking-coordenacao", viewAs],
    enabled: !isCaptador,
    queryFn: async () => {
      const { data, error } = viewAs
        ? await supabase.rpc("get_captados_ranking_coordenacao_for" as never, { _user_id: viewAs } as never)
        : await supabase.rpc("get_captados_ranking_coordenacao" as never);
      if (error) throw error;
      return ((data || []) as unknown as RankingRow[]).map((r) => ({
        ...r,
        total: Number(r.total) || 0,
      }));
    },
  });

  const { data: rankingLider = [], isLoading: lrl } = useQuery({
    queryKey: ["captados-ranking-liderancas", viewAs],
    enabled: !isCaptador,
    queryFn: async () => {
      const { data, error } = viewAs
        ? await supabase.rpc("get_captados_ranking_liderancas_for" as never, { _user_id: viewAs } as never)
        : await supabase.rpc("get_captados_ranking_liderancas" as never);
      if (error) throw error;
      return ((data || []) as unknown as RankingRow[]).map((r) => ({
        ...r,
        total: Number(r.total) || 0,
      }));
    },
  });

  const { data: todosCaptados = [], isLoading: lm } = useEleitoresCaptados();

  // Ids dos apoiadores visíveis para o coordenador simulado
  const { data: scopeIds = null } = useQuery({
    queryKey: ["captados-scope-ids", viewAs],
    enabled: !!viewAs,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_captados_scope_for" as never, { _user_id: viewAs } as never);
      if (error) throw error;
      return new Set(((data || []) as unknown as { captado_id: string }[]).map((r) => r.captado_id));
    },
  });

  const meusCaptados = useMemo(() => {
    if (!viewAs || !scopeIds) return todosCaptados;
    return todosCaptados.filter((e: any) => scopeIds.has(e.id));
  }, [todosCaptados, viewAs, scopeIds]);


  const [searchRanking, setSearchRanking] = useState("");
  const [searchRankingCoord, setSearchRankingCoord] = useState("");
  const [searchRankingLider, setSearchRankingLider] = useState("");
  const [searchMeus, setSearchMeus] = useState("");
  const [verTodosCap, setVerTodosCap] = useState(false);
  const [verTodosCoord, setVerTodosCoord] = useState(false);
  const [verTodosLider, setVerTodosLider] = useState(false);
  const [rankingTab, setRankingTab] = useState<"captadores" | "coordenacao" | "liderancas">("captadores");
  const coordExportRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [revertTarget, setRevertTarget] = useState<{ id: string; nome: string } | null>(null);
  const [reverting, setReverting] = useState(false);

  // Responsável padrão da captação própria: Felipe Carmona
  const CAPTACAO_PROPRIA_USER_ID = "abd8f3d1-51be-4060-b04f-2c2dd6288bb1";

  const handleReverter = async () => {
    if (!revertTarget || !currentUserId) return;
    setReverting(true);
    try {
      const { error } = await supabase
        .from("eleitores_captados")
        .update({
          captado_por_user_id: CAPTACAO_PROPRIA_USER_ID,
          tipo_captador: "usuario",
          lideranca_id: null,
        } as never)
        .eq("id", revertTarget.id);
      if (error) throw error;
      toast({ title: "Captação revertida", description: `${revertTarget.nome} agora está sob captação de Felipe Carmona.` });
      setRevertTarget(null);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["eleitores-captados"] }),
        qc.invalidateQueries({ queryKey: ["captados-ranking"] }),
        qc.invalidateQueries({ queryKey: ["captados-ranking-coordenacao"] }),
        qc.invalidateQueries({ queryKey: ["captados-ranking-liderancas"] }),
        qc.invalidateQueries({ queryKey: ["captados-total-real"] }),
        qc.invalidateQueries({ queryKey: ["captados-meu-individual"] }),
      ]);
    } catch (e: any) {
      toast({ title: "Erro ao reverter", description: e?.message || "", variant: "destructive" });
    } finally {
      setReverting(false);
    }
  };


  useEffect(() => {
    if (userRole === "coordenador_estadual" || userRole === "coordenador_regional") {
      setRankingTab("liderancas");
    }
  }, [userRole]);

  const handleExportCoordImage = async () => {
    if (!coordExportRef.current) return;
    setExporting(true);
    try {
      const dataUrl = await toPng(coordExportRef.current, {
        pixelRatio: 2,
        backgroundColor: "#ffffff",
        cacheBust: true,
      });
      const link = document.createElement("a");
      link.download = `ranking-coordenacao-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = dataUrl;
      link.click();
      toast({ title: "Imagem gerada", description: "Ranking salvo em PNG." });
    } catch (e: any) {
      toast({ title: "Erro ao gerar imagem", description: e?.message || "", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };
  const rankingFiltered = useMemo(() => {
    const q = searchRanking.trim().toLowerCase();
    // O escopo já vem filtrado do servidor (cada usuário só recebe a própria rede)
    const base = ranking;
    return q ? base.filter(r => r.nome.toLowerCase().includes(q)) : base;
  }, [ranking, searchRanking]);


  const rankingCoordFiltered = useMemo(() => {
    const q = searchRankingCoord.trim().toLowerCase();
    return q ? rankingCoord.filter(r => r.nome.toLowerCase().includes(q)) : rankingCoord;
  }, [rankingCoord, searchRankingCoord]);
  const rankingLiderFiltered = useMemo(() => {
    const q = searchRankingLider.trim().toLowerCase();
    const base = rankingLider.filter(r => r.total > 0);
    return q ? base.filter(r => r.nome.toLowerCase().includes(q)) : base;
  }, [rankingLider, searchRankingLider]);
  const meusFiltered = useMemo(() => {
    const q = searchMeus.trim().toLowerCase();
    return q ? meusCaptados.filter((e: any) => (e.nome_completo || "").toLowerCase().includes(q) || (e.telefone || "").includes(q)) : meusCaptados;
  }, [meusCaptados, searchMeus]);


  const totalGeral = totalGeralReal;
  const meuIndividualRankingTotal = useMemo(() => {
    if (!currentUserId) return 0;
    return ranking.find((r) => r.user_id === currentUserId)?.total ?? 0;
  }, [currentUserId, ranking]);
  const meuIndividualValue = meuIndividualTotal || meuIndividualRankingTotal;
  const showNetworkTotal = !hasFullAccess && !isCaptador;

  return (
    <div className="space-y-5 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Vote className="h-6 w-6 text-primary" /> Apoiadores Captados
        </h1>
        <p className="text-sm text-muted-foreground">
          Ranking geral de captadores e seus apoiadores cadastrados.
        </p>
      </div>

      {isAdmin && (
        <Card>
          <CardContent className="pt-4 pb-4 flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1 min-w-[240px] flex-1">
              <label className="text-[11px] text-muted-foreground">
                Ver como coordenador (visão exata que ele tem)
              </label>
              <NativeSelect
                value={viewAsId}
                onChange={(e) => setViewAsId(e.target.value)}
                className="h-9"
                options={[
                  { value: "", label: "Visão de administrador (tudo)" },
                  ...coordenadores
                    .slice()
                    .sort((a, b) => (a.nome || "").localeCompare(b.nome || ""))
                    .map((c) => ({ value: c.user_id, label: c.nome || c.email })),
                ]}
              />
            </div>
            {viewAs && (
              <Button variant="outline" size="sm" className="h-9" onClick={() => setViewAsId("")}>
                Voltar à visão geral
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {viewAs && (
        <p className="text-xs rounded-md border border-amber-300 bg-amber-50 text-amber-800 px-3 py-2">
          Simulando a visão de <strong>{coordenadores.find((c) => c.user_id === viewAs)?.nome || "coordenador"}</strong>.
          Os números abaixo são exatamente os que ele enxerga.
        </p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {hasFullAccess && <StatBox icon={Vote} label="Total geral captado" value={totalGeral} variant="primary" />}
        {hasFullAccess && <StatBox icon={Users} label="Captadores ativos" value={ranking.length} />}
        {isCaptador && <StatBox icon={MapPin} label="Meus captados" value={meusCaptados.length} variant="accent" />}
        {showNetworkTotal && <StatBox icon={Vote} label={viewAs ? "Total captado pela equipe dele" : "Total captado pela minha equipe"} value={totalGeral} variant="primary" />}

        {showNetworkTotal && <StatBox icon={Users} label={viewAs ? "Captadores dele" : "Meus captadores"} value={ranking.length} variant="accent" />}
      </div>


      {!isCaptador && (

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-500" /> Ranking
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={rankingTab} onValueChange={(v) => setRankingTab(v as "captadores" | "coordenacao" | "liderancas")}>
            <TabsList className="grid w-full grid-cols-3 mb-3">
              <TabsTrigger value="captadores" className="gap-2">
                <Trophy className="h-3.5 w-3.5" /> Individual
              </TabsTrigger>
              <TabsTrigger value="liderancas" className="gap-2">
                <Star className="h-3.5 w-3.5" /> Lideranças
              </TabsTrigger>
              <TabsTrigger value="coordenacao" className="gap-2">
                <UserCheck className="h-3.5 w-3.5" /> Coordenação
              </TabsTrigger>
            </TabsList>

            <TabsContent value="captadores" className="mt-0">
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar captador por nome..." value={searchRanking} onChange={e => setSearchRanking(e.target.value)} className="pl-9 h-9" />
              </div>
              {lr ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : rankingFiltered.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  {ranking.length === 0 ? "Nenhum apoiador captado ainda." : "Nenhum captador encontrado."}
                </p>
              ) : (
                <>
                  <RankingList
                    rows={(searchRanking.trim() || verTodosCap) ? rankingFiltered : rankingFiltered.slice(0, 5)}
                    maxValue={ranking[0]?.total || 1}
                  />
                  {!searchRanking.trim() && rankingFiltered.length > 5 && (
                    <Button variant="outline" size="sm" className="w-full mt-3" onClick={() => setVerTodosCap(v => !v)}>
                      {verTodosCap ? "Mostrar apenas Top 5" : `Ver todos (${rankingFiltered.length})`}
                    </Button>
                  )}
                </>
              )}
            </TabsContent>

            <TabsContent value="liderancas" className="mt-0">
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar liderança por nome..." value={searchRankingLider} onChange={e => setSearchRankingLider(e.target.value)} className="pl-9 h-9" />
              </div>
              {lrl ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : rankingLiderFiltered.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Nenhuma liderança com apoiadores captados ainda.
                </p>
              ) : (
                <>
                  <RankingList
                    rows={(searchRankingLider.trim() || verTodosLider) ? rankingLiderFiltered : rankingLiderFiltered.slice(0, 5)}
                    maxValue={rankingLiderFiltered[0]?.total || 1}
                  />
                  {!searchRankingLider.trim() && rankingLiderFiltered.length > 5 && (
                    <Button variant="outline" size="sm" className="w-full mt-3" onClick={() => setVerTodosLider(v => !v)}>
                      {verTodosLider ? "Mostrar apenas Top 5" : `Ver todos (${rankingLiderFiltered.length})`}
                    </Button>
                  )}
                </>
              )}
            </TabsContent>


            <TabsContent value="coordenacao" className="mt-0">
              <div className="flex gap-2 mb-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Buscar coordenação por nome..." value={searchRankingCoord} onChange={e => setSearchRankingCoord(e.target.value)} className="pl-9 h-9" />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 shrink-0"
                  onClick={handleExportCoordImage}
                  disabled={exporting || rankingCoord.length === 0}
                  title="Baixar ranking completo em imagem"
                >
                  {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  <span className="ml-1.5 hidden sm:inline">Baixar imagem</span>
                </Button>
              </div>
              {lrc ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : rankingCoordFiltered.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  {rankingCoord.length === 0 ? "Nenhum apoiador captado por equipe vinculada a coordenação ainda." : "Nenhuma coordenação encontrada."}
                </p>
              ) : (
                <>
                  <RankingList
                    rows={(searchRankingCoord.trim() || verTodosCoord) ? rankingCoordFiltered : rankingCoordFiltered.slice(0, 5)}
                    maxValue={rankingCoord[0]?.total || 1}
                  />
                  {!searchRankingCoord.trim() && rankingCoordFiltered.length > 5 && (
                    <Button variant="outline" size="sm" className="w-full mt-3" onClick={() => setVerTodosCoord(v => !v)}>
                      {verTodosCoord ? "Mostrar apenas Top 5" : `Ver todos (${rankingCoordFiltered.length})`}
                    </Button>
                  )}
                </>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      )}

      {!isCaptador && <EvolucaoCaptacaoChart />}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            {hasFullAccess ? "Todos os Apoiadores Captados" : isCaptador ? "Meus Apoiadores Captados" : "Apoiadores da Minha Rede"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por nome ou telefone..." value={searchMeus} onChange={e => setSearchMeus(e.target.value)} className="pl-9 h-9" />
          </div>
          {lm ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : meusFiltered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              {meusCaptados.length === 0 ? (hasFullAccess ? "Nenhum apoiador cadastrado ainda." : "Você ainda não captou nenhum apoiador. Use seu link/QR Code \"APOIADORES\" para começar.") : "Nenhum apoiador encontrado."}
            </p>
          ) : (
            <div className="grid gap-2">
              {meusFiltered.slice(0, hasFullAccess ? 500 : 100).map((e) => (
                <div
                  key={e.id}
                  className="flex items-start justify-between gap-3 rounded-lg border p-2.5 hover:bg-accent/30 transition-colors flex-wrap"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{e.nome_completo}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                      {e.telefone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {e.telefone}
                        </span>
                      )}
                      {(e.cidade_nome || e.bairro) && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {[e.bairro, e.cidade_nome].filter(Boolean).join(" · ")}
                        </span>
                      )}
                    </div>
                    {e.observacoes && (
                      <p className="text-xs text-muted-foreground mt-1 italic border-l-2 border-primary/30 pl-2">
                        {e.observacoes}
                      </p>
                    )}
                    <LeadObsBadge phone={e.telefone} />
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                    <LeadStatusControls phone={e.telefone} nome={e.nome_completo} compact />
                    {e.telefone && canSendWhatsApp && (
                      <a
                        href={waLink(e.telefone, e.nome_completo)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-md bg-green-600 hover:bg-green-700 text-white text-xs font-medium px-2 py-1 transition-colors h-8"
                        title="Enviar WhatsApp"
                      >
                        <MessageCircle className="h-3 w-3" /> WhatsApp
                      </a>
                    )}
                    {canRevertCaptacao && e.captado_por_user_id !== currentUserId && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 gap-1 text-xs"
                        title="Retirar do captador/coordenador atual e colocar como captação própria"
                        onClick={() => setRevertTarget({ id: e.id, nome: e.nome_completo })}
                      >
                        <RotateCcw className="h-3 w-3" /> Captação própria
                      </Button>
                    )}
                    <span className="text-[10px] text-muted-foreground self-center">
                      {new Date(e.created_at).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                </div>
              ))}
              {meusFiltered.length > (hasFullAccess ? 500 : 100) && (
                <p className="text-center text-xs text-muted-foreground py-2">
                  Mostrando {hasFullAccess ? 500 : 100} de {meusFiltered.length}. Use a busca para refinar.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!revertTarget} onOpenChange={(v) => !v && setRevertTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reverter para captação própria</DialogTitle>
            <DialogDescription>
              {revertTarget?.nome} deixará de ser contabilizado para o captador, liderança e coordenador atuais e passará a contar como captação sua.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevertTarget(null)} disabled={reverting}>Cancelar</Button>
            <Button onClick={handleReverter} disabled={reverting} className="gap-1.5">
              {reverting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />} Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>



      {/* Off-screen node used only for image export */}
      <div style={{ position: "fixed", left: "-10000px", top: 0, pointerEvents: "none" }} aria-hidden>
        <div
          ref={coordExportRef}
          style={{
            width: 900,
            padding: 32,
            background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
            fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
            color: "#0f172a",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, borderBottom: "3px solid #1e2d50", paddingBottom: 12 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: "#1e2d50" }}>🏆 Ranking Coordenação</h2>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: "#64748b" }}>Apoiadores captados por equipe vinculada • {new Date().toLocaleDateString("pt-BR")}</p>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: 1 }}>Total</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#1e2d50", fontFamily: "monospace" }}>
                {rankingCoord.reduce((a, r) => a + r.total, 0).toLocaleString("pt-BR")}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {rankingCoord.map((r, i) => {
              const max = rankingCoord[0]?.total || 1;
              const pct = (r.total / max) * 100;
              const medal = ["#f59e0b", "#94a3b8", "#b45309"];
              const bg = medal[i] || "#1e2d50";
              return (
                <div key={r.user_id}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: "50%", background: bg, color: "#fff", fontWeight: 700, fontSize: 13 }}>{i + 1}</span>
                      <span style={{ fontSize: 15, fontWeight: 600 }}>{r.nome}</span>
                    </div>
                    <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 15, background: "#f1f5f9", padding: "3px 10px", borderRadius: 6 }}>{r.total.toLocaleString("pt-BR")}</span>
                  </div>
                  <div style={{ height: 6, background: "#e2e8f0", borderRadius: 999, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg, #1e2d50, #3b5998)", borderRadius: 999 }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 20, paddingTop: 12, borderTop: "1px solid #e2e8f0", textAlign: "center", fontSize: 11, color: "#94a3b8" }}>
            Campanha 2026 · Inteligência de Campanha
          </div>
        </div>
      </div>
    </div>
  );
}

function RankingList({ rows, maxValue }: { rows: RankingRow[]; maxValue: number }) {
  const medal = ["hsl(38, 92%, 50%)", "hsl(0, 0%, 70%)", "hsl(25, 60%, 45%)"];
  return (
    <div className="space-y-2">
      {rows.map((r, i) => {
        const pct = (r.total / (maxValue || 1)) * 100;
        return (
          <div key={r.user_id} className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white shrink-0"
                  style={{ backgroundColor: medal[i] || "hsl(var(--primary))" }}
                >
                  {i + 1}
                </span>
                <span className="font-medium text-sm truncate">{r.nome}</span>
              </div>
              <Badge variant="secondary" className="font-mono text-xs">
                {r.total.toLocaleString("pt-BR")}
              </Badge>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StatBox({
  icon: Icon,
  label,
  value,
  variant = "default",
}: {
  icon: any;
  label: string;
  value: number;
  variant?: "default" | "primary" | "accent";
}) {
  const bg =
    variant === "primary"
      ? "bg-primary/10 border-primary/20"
      : variant === "accent"
      ? "bg-accent/30 border-accent/40"
      : "bg-card border-border";
  return (
    <div className={`rounded-xl border p-4 ${bg}`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-[11px] text-muted-foreground font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold font-mono">{value.toLocaleString("pt-BR")}</p>
    </div>
  );
}
