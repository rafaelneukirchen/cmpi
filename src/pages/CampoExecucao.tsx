import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/ui/native-select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Play, Square, Camera, Loader2, MapPin, Compass, Upload, AlertTriangle, ClipboardList, CalendarClock, UserCog, User, Search } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import {
  TIPO_ACAO_OPTIONS, labelTipo, getCurrentPosition,
  useCidadesSelect,
} from "@/hooks/useCampoActions";

// Distância aproximada em metros entre dois pontos (Haversine simplificado)
function distMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

const STATIONARY_MS = 20 * 60 * 1000; // 20 min
const STATIONARY_RADIUS_M = 40; // considera parado se ficou dentro de ~40m
const CHECK_INTERVAL_MS = 60 * 1000; // 1 min

export default function CampoExecucao() {
  const { user, userRole } = useAuth();
  const isCoordOrAdmin = userRole === "admin" || (userRole ?? "").startsWith("coordenador");
  const qc = useQueryClient();
  const { data: cidades = [] } = useCidadesSelect();

  // Form para iniciar ação avulsa
  const [tipo, setTipo] = useState("panfletagem_semaforo");
  const [cidadeId, setCidadeId] = useState("");
  const [bairro, setBairro] = useState("");
  const [working, setWorking] = useState(false);
  const [busca, setBusca] = useState("");

  // Ações em andamento e minhas execuções recentes
  const { data: execucoes = [], isLoading } = useQuery({
    queryKey: ["minhas-execucoes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("acoes_execucao")
        .select("*, midias:acoes_midias(id, url, tipo)")
        .order("iniciado_em", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as any[];
    },
  });

  const enAndamento = execucoes.filter((e) => !e.encerrado_em);

  // Identificação de quem está executando e de qual coordenador é a ação
  const planejamentoIds = Array.from(new Set(execucoes.map((e) => e.planejamento_id).filter(Boolean)));
  const { data: planejamentosInfo = [] } = useQuery({
    queryKey: ["exec-planejamentos-info", planejamentoIds.join(",")],
    enabled: planejamentoIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("planejamento_semanal")
        .select("id, coordenador_user_id, lideranca:liderancas(nome)")
        .in("id", planejamentoIds as string[]);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const userIds = Array.from(new Set([
    ...execucoes.map((e) => e.iniciado_por_user_id),
    ...planejamentosInfo.map((p: any) => p.coordenador_user_id),
  ].filter(Boolean)));

  const { data: perfis = [] } = useQuery({
    queryKey: ["exec-perfis", userIds.join(",")],
    enabled: userIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, nome")
        .in("user_id", userIds as string[]);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const nomePorUser = new Map<string, string>(perfis.map((p: any) => [p.user_id, p.nome]));
  const planoPorId = new Map<string, any>(planejamentosInfo.map((p: any) => [p.id, p]));

  function infoResponsavel(e: any) {
    const plano = e.planejamento_id ? planoPorId.get(e.planejamento_id) : null;
    return {
      executor: nomePorUser.get(e.iniciado_por_user_id) ?? null,
      coordenador: plano?.coordenador_user_id ? nomePorUser.get(plano.coordenador_user_id) ?? null : null,
      lideranca: plano?.lideranca?.nome ?? null,
    };
  }


  // Ações planejadas pelo coordenador (do usuário ou de sua equipe) que ainda não foram executadas
  const { data: planejadas = [], isLoading: loadingPlan } = useQuery({
    queryKey: ["acoes-planejadas-execucao", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const hoje = new Date();
      const seteDiasAtras = new Date(hoje.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("acoes_planejadas")
        .select(`
          id, tipo_acao, data_prevista, hora_prevista, local_previsto, participantes_previstos,
          planejamento:planejamento_semanal!inner(
            id, semana_inicio, semana_fim, cidade_id, bairro_principal, bairros_secundarios,
            meta_semana, equipe_prevista, coordenador_user_id, lideranca_id,
            cidade:cidades(nome), lideranca:liderancas(nome)
          )
        `)
        .gte("planejamento.semana_fim", seteDiasAtras)
        .order("data_prevista", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  // Nomes dos coordenadores dos planejamentos listados
  const planCoordIds = Array.from(new Set(planejadas.map((p: any) => p.planejamento?.coordenador_user_id).filter(Boolean)));
  const { data: planCoordPerfis = [] } = useQuery({
    queryKey: ["exec-plan-coord-perfis", planCoordIds.join(",")],
    enabled: planCoordIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("user_id, nome").in("user_id", planCoordIds as string[]);
      if (error) throw error;
      return (data ?? []) as any[];
    },
    staleTime: 5 * 60_000,
  });
  const nomeCoordPlano = (p: any) => {
    const id = p.planejamento?.coordenador_user_id;
    if (!id) return null;
    return planCoordPerfis.find((x: any) => x.user_id === id)?.nome ?? nomePorUser.get(id) ?? null;
  };

  const norm = (s: string) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const planejadasFiltradas = useMemo(() => {
    const termo = norm(busca.trim());
    if (!termo) return planejadas;
    return planejadas.filter((p: any) => {
      const coord = norm(nomeCoordPlano(p) ?? "");
      const lider = norm(p.planejamento?.lideranca?.nome ?? "");
      const cidade = norm(p.planejamento?.cidade?.nome ?? "");
      const bairro = norm(p.planejamento?.bairro_principal ?? "");
      const local = norm(p.local_previsto ?? "");
      return coord.includes(termo) || lider.includes(termo) || cidade.includes(termo) || bairro.includes(termo) || local.includes(termo);
    });
  }, [planejadas, busca, planCoordPerfis, nomePorUser]);

  // Detalhe do planejamento (dialog)
  const [planoDetalhe, setPlanoDetalhe] = useState<any | null>(null);

  // Mapa: acao_planejada_id -> execução mais recente (para saber status)
  const execPorPlanejada = new Map<string, any>();
  for (const ex of execucoes) {
    if (ex.acao_planejada_id && !execPorPlanejada.has(ex.acao_planejada_id)) {
      execPorPlanejada.set(ex.acao_planejada_id, ex);
    }
  }


  async function iniciarPlanejada(p: any) {
    setWorking(true);
    try {
      const pos = await getCurrentPosition();
      const cidadeNome = p.planejamento?.cidade?.nome ?? null;
      const { error } = await supabase.from("acoes_execucao").insert({
        acao_planejada_id: p.id,
        planejamento_id: p.planejamento?.id ?? null,
        tipo_acao: p.tipo_acao as any,
        iniciado_por_user_id: user?.id,
        lat_inicio: pos?.lat ?? null,
        lng_inicio: pos?.lng ?? null,
        cidade_id: p.planejamento?.cidade_id ?? null,
        cidade_execucao: cidadeNome,
        bairro_execucao: p.planejamento?.bairro_principal ?? null,
      } as any);
      if (error) throw error;
      toast.success("Ação planejada iniciada");
      qc.invalidateQueries({ queryKey: ["minhas-execucoes"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setWorking(false);
    }
  }


  async function iniciar() {
    if (!cidadeId) return toast.error("Selecione o município");
    setWorking(true);
    try {
      const pos = await getCurrentPosition();
      const cidadeNome = cidades.find((c) => c.id === cidadeId)?.nome ?? null;
      const { error } = await supabase.from("acoes_execucao").insert({
        tipo_acao: tipo as any,
        iniciado_por_user_id: user?.id,
        lat_inicio: pos?.lat ?? null,
        lng_inicio: pos?.lng ?? null,
        cidade_id: cidadeId,
        cidade_execucao: cidadeNome,
        bairro_execucao: bairro || null,
      } as any);
      if (error) throw error;
      toast.success("Ação iniciada");
      setBairro("");
      qc.invalidateQueries({ queryKey: ["minhas-execucoes"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setWorking(false);
    }
  }

  async function encerrar(execId: string) {
    setWorking(true);
    try {
      const pos = await getCurrentPosition();
      const { error } = await supabase
        .from("acoes_execucao")
        .update({ encerrado_em: new Date().toISOString(), lat_fim: pos?.lat ?? null, lng_fim: pos?.lng ?? null })
        .eq("id", execId);
      if (error) throw error;
      // calcular distância via função
      try {
        const { data: dist } = await supabase.rpc("calc_acao_distancia", { p_exec_id: execId });
        if (typeof dist === "number") {
          await supabase.from("acoes_execucao").update({ distancia_metros: dist }).eq("id", execId);
        }
      } catch { /* ok */ }
      toast.success("Ação encerrada");
      qc.invalidateQueries({ queryKey: ["minhas-execucoes"] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setWorking(false);
    }
  }

  async function uploadMidia(execId: string, file: File) {
    const ext = file.name.split(".").pop();
    const path = `campo/${execId}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("app-assets").upload(path, file, { upsert: false });
    if (upErr) return toast.error(upErr.message);
    const { data: pub } = supabase.storage.from("app-assets").getPublicUrl(path);
    const tipoMidia = file.type.startsWith("video") ? "video" : "foto";
    await supabase.from("acoes_midias").insert({ execucao_id: execId, url: pub.publicUrl, tipo: tipoMidia });
    toast.success("Mídia anexada");
    qc.invalidateQueries({ queryKey: ["minhas-execucoes"] });
  }

  async function salvarObs(execId: string, obs: string, participantes: number) {
    await supabase.from("acoes_execucao").update({ observacoes: obs, participantes_reais: participantes }).eq("id", execId);
    toast.success("Salvo");
    qc.invalidateQueries({ queryKey: ["minhas-execucoes"] });
  }

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Compass className="h-6 w-6 text-primary" /> Execução de Campo</h1>
        <p className="text-sm text-muted-foreground">Inicie e encerre ações com GPS automático</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Iniciar nova ação</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div><Label>Tipo</Label><NativeSelect value={tipo} options={TIPO_ACAO_OPTIONS as any} onChange={(e) => setTipo(e.target.value)} /></div>
          <div><Label>Município</Label><NativeSelect placeholder="Selecione" value={cidadeId} options={cidades.map((c) => ({ value: c.id, label: c.nome }))} onChange={(e) => setCidadeId(e.target.value)} /></div>
          <div><Label>Bairro</Label><Input value={bairro} onChange={(e) => setBairro(e.target.value)} placeholder="Bairro" /></div>
          <Button onClick={iniciar} disabled={working}>{working ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Play className="h-4 w-4 mr-1" />}Iniciar Ação</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-primary" /> Ações planejadas pelo coordenador
            </CardTitle>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8 h-9"
                placeholder="Buscar por coordenador, liderança, cidade..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {loadingPlan ? (
            <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : planejadasFiltradas.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              {busca
                ? "Nenhuma ação planejada encontrada para a busca."
                : "Nenhuma ação planejada disponível. Peça ao coordenador para criar um planejamento em Planejamento de Campo."}
            </p>
          ) : (
            planejadasFiltradas.map((p) => {
              const ex = execPorPlanejada.get(p.id);
              const emAndamento = ex && !ex.encerrado_em;
              const concluida = ex && ex.encerrado_em;
              return (
                <div
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 bg-background hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => setPlanoDetalhe(p.planejamento)}
                  title="Clique para ver o planejamento"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge>{labelTipo(p.tipo_acao)}</Badge>
                      {concluida && <Badge variant="secondary">Concluída</Badge>}
                      {emAndamento && <Badge className="bg-primary">Em andamento</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="inline-flex items-center gap-1">
                        <UserCog className="h-3 w-3" />
                        Coord.: {nomeCoordPlano(p) ?? "—"}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <User className="h-3 w-3" />
                        Liderança: {p.planejamento?.lideranca?.nome ?? "—"}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="inline-flex items-center gap-1">
                        <CalendarClock className="h-3 w-3" />
                        {p.data_prevista ? new Date(p.data_prevista + "T00:00:00").toLocaleDateString("pt-BR") : "Sem data"}
                        {p.hora_prevista ? ` • ${String(p.hora_prevista).slice(0, 5)}` : ""}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {p.planejamento?.cidade?.nome ?? "—"}
                        {p.planejamento?.bairro_principal ? ` • ${p.planejamento.bairro_principal}` : ""}
                      </span>
                      {p.local_previsto && <span>Local: {p.local_previsto}</span>}
                      {p.participantes_previstos > 0 && <span>{p.participantes_previstos} previstos</span>}
                    </div>
                  </div>
                  <div onClick={(ev) => ev.stopPropagation()}>
                    <Button
                      size="sm"
                      disabled={working || emAndamento || concluida}
                      onClick={() => iniciarPlanejada(p)}
                    >
                      <Play className="h-4 w-4 mr-1" />
                      {emAndamento ? "Em andamento" : concluida ? "Concluída" : "Iniciar"}
                    </Button>
                  </div>
                </div>

              );
            })
          )}
        </CardContent>
      </Card>

      <Dialog open={!!planoDetalhe} onOpenChange={(o) => !o && setPlanoDetalhe(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Planejamento da semana</DialogTitle>
            <DialogDescription>
              {planoDetalhe?.semana_inicio && planoDetalhe?.semana_fim
                ? `${new Date(planoDetalhe.semana_inicio + "T00:00:00").toLocaleDateString("pt-BR")} → ${new Date(planoDetalhe.semana_fim + "T00:00:00").toLocaleDateString("pt-BR")}`
                : "—"}
            </DialogDescription>
          </DialogHeader>
          {planoDetalhe && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><span className="text-muted-foreground">Coordenador:</span> {planCoordPerfis.find((x: any) => x.user_id === planoDetalhe.coordenador_user_id)?.nome ?? "—"}</div>
                <div><span className="text-muted-foreground">Liderança:</span> {planoDetalhe.lideranca?.nome ?? "—"}</div>
                <div><span className="text-muted-foreground">Município:</span> {planoDetalhe.cidade?.nome ?? "—"}</div>
                <div><span className="text-muted-foreground">Bairro principal:</span> {planoDetalhe.bairro_principal ?? "—"}</div>
                <div className="sm:col-span-2"><span className="text-muted-foreground">Bairros secundários:</span> {(planoDetalhe.bairros_secundarios ?? []).join(", ") || "—"}</div>
                <div><span className="text-muted-foreground">Equipe prevista:</span> {planoDetalhe.equipe_prevista ?? 0}</div>
                <div className="sm:col-span-2"><span className="text-muted-foreground">Meta da semana:</span> {planoDetalhe.meta_semana || "—"}</div>
              </div>
              <div>
                <div className="font-medium mb-1">Ações planejadas</div>
                <div className="space-y-1">
                  {planejadas
                    .filter((a: any) => a.planejamento?.id === planoDetalhe.id)
                    .map((a: any) => (
                      <div key={a.id} className="rounded-md border p-2 text-xs flex flex-wrap gap-x-3 gap-y-1 items-center">
                        <Badge variant="outline">{labelTipo(a.tipo_acao)}</Badge>
                        <span>{a.data_prevista ? new Date(a.data_prevista + "T00:00:00").toLocaleDateString("pt-BR") : "Sem data"}{a.hora_prevista ? ` • ${String(a.hora_prevista).slice(0, 5)}` : ""}</span>
                        {a.local_previsto && <span>Local: {a.local_previsto}</span>}
                        {a.participantes_previstos > 0 && <span>{a.participantes_previstos} pessoas</span>}
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPlanoDetalhe(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {enAndamento.length > 0 && (
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader><CardTitle className="text-base">Em andamento</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {enAndamento.map((e) => <ExecCard key={e.id} e={e} info={infoResponsavel(e)} onEnd={() => encerrar(e.id)} onUpload={(f) => uploadMidia(e.id, f)} onSave={(o, p) => salvarObs(e.id, o, p)} active />)}
          </CardContent>
        </Card>
      )}


      {isCoordOrAdmin && (
        <Card>
          <CardHeader><CardTitle className="text-base">Histórico recente</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin" /></div>
              : execucoes.filter((e) => e.encerrado_em).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhuma execução ainda.</p>
              ) : execucoes.filter((e) => e.encerrado_em).map((e) => (
                <ExecCard key={e.id} e={e} info={infoResponsavel(e)} onUpload={(f) => uploadMidia(e.id, f)} onSave={(o, p) => salvarObs(e.id, o, p)} />
              ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

type ExecInfo = { executor: string | null; coordenador: string | null; lideranca: string | null };

function ExecCard({ e, info, onEnd, onUpload, onSave, active }: { e: any; info?: ExecInfo; onEnd?: () => void; onUpload: (f: File) => void; onSave: (o: string, p: number) => void; active?: boolean }) {
  const [obs, setObs] = useState<string>(e.observacoes || "");
  const [part, setPart] = useState<number>(e.participantes_reais || 0);
  const [needsPhoto, setNeedsPhoto] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const anchorRef = useRef<{ lat: number; lng: number; ts: number } | null>(null);
  const lastPromptAnchorTsRef = useRef<number | null>(null);

  // Detecta parado no local por mais de 20 min enquanto a ação está ativa
  useEffect(() => {
    if (!active) return;
    let cancelled = false;

    async function tick() {
      const pos = await getCurrentPosition();
      if (cancelled || !pos) return;
      const now = Date.now();
      const anchor = anchorRef.current;
      if (!anchor) {
        anchorRef.current = { ...pos, ts: now };
        return;
      }
      const d = distMeters(anchor, pos);
      if (d > STATIONARY_RADIUS_M) {
        // moveu — reseta âncora
        anchorRef.current = { ...pos, ts: now };
        return;
      }
      // ficou parado
      if (
        now - anchor.ts >= STATIONARY_MS &&
        lastPromptAnchorTsRef.current !== anchor.ts
      ) {
        lastPromptAnchorTsRef.current = anchor.ts;
        setNeedsPhoto(true);
      }
    }

    tick();
    const id = window.setInterval(tick, CHECK_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [active, e.id]);

  function openCamera() {
    cameraInputRef.current?.click();
  }

  async function handleCameraFile(file: File) {
    await onUpload(file);
    // reseta âncora após foto enviada
    const pos = await getCurrentPosition();
    if (pos) anchorRef.current = { ...pos, ts: Date.now() };
    setNeedsPhoto(false);
  }

  return (
    <div className="rounded-lg border p-3 space-y-2 bg-background">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex items-center gap-2">
          <Badge>{labelTipo(e.tipo_acao)}</Badge>
          <span className="text-xs text-muted-foreground"><MapPin className="inline h-3 w-3 mr-1" />{e.cidade_execucao} {e.bairro_execucao ? `• ${e.bairro_execucao}` : ""}</span>
        </div>
        <div className="text-xs text-muted-foreground">
          {new Date(e.iniciado_em).toLocaleString("pt-BR")}
          {e.encerrado_em && <> → {new Date(e.encerrado_em).toLocaleString("pt-BR")}</>}
          {e.distancia_metros > 0 && <> • {(e.distancia_metros / 1000).toFixed(2)} km</>}
        </div>
      </div>
      {(info?.coordenador || info?.executor || info?.lideranca) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {info?.coordenador && (
            <Badge variant="secondary" className="text-[11px]">
              <UserCog className="h-3 w-3 mr-1" />Coordenador: {info.coordenador}
            </Badge>
          )}
          {info?.lideranca && (
            <Badge variant="outline" className="text-[11px]">Liderança: {info.lideranca}</Badge>
          )}
          {info?.executor && (
            <Badge variant="outline" className="text-[11px]">
              <User className="h-3 w-3 mr-1" />Executando: {info.executor}
            </Badge>
          )}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <div><Label className="text-xs">Participantes reais</Label><Input type="number" min={0} value={part} onChange={(ev) => setPart(parseInt(ev.target.value) || 0)} /></div>
        <div className="md:col-span-2"><Label className="text-xs">Observações</Label><Textarea rows={2} value={obs} onChange={(ev) => setObs(ev.target.value)} /></div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => onSave(obs, part)}>Salvar</Button>
        {active && (
          <Button size="sm" variant="outline" onClick={openCamera}>
            <Camera className="h-4 w-4 mr-1" /> Tirar foto (câmera)
          </Button>
        )}
        <label className="inline-flex items-center gap-1 cursor-pointer text-sm border rounded-md h-9 px-3 hover:bg-accent">
          <Upload className="h-4 w-4" /> Anexar mídia
          <input type="file" accept="image/*,video/*" className="hidden" onChange={(ev) => { const f = ev.target.files?.[0]; if (f) onUpload(f); ev.target.value = ""; }} />
        </label>
        {/* Input dedicado que abre a câmera (não a galeria) */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(ev) => { const f = ev.target.files?.[0]; if (f) handleCameraFile(f); ev.target.value = ""; }}
        />
        {active && onEnd && <Button size="sm" variant="destructive" onClick={onEnd}><Square className="h-4 w-4 mr-1" />Encerrar Ação</Button>}
        {e.midias?.length > 0 && <span className="text-xs text-muted-foreground">{e.midias.length} mídia(s)</span>}
      </div>
      {e.midias?.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {e.midias.slice(0, 6).map((m: any) => (
            m.tipo === "video"
              ? <video key={m.id} src={m.url} className="h-16 w-24 rounded object-cover" controls />
              : <img key={m.id} src={m.url} className="h-16 w-16 rounded object-cover" alt="midia" />
          ))}
        </div>
      )}

      {/* Dialog bloqueante quando fica parado por mais de 20min */}
      <Dialog open={needsPhoto} onOpenChange={(open) => { if (!open) return; /* impede fechar sem foto */ }}>
        <DialogContent className="max-w-md" onEscapeKeyDown={(e) => e.preventDefault()} onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" /> Comprovação necessária
            </DialogTitle>
            <DialogDescription>
              Você está no mesmo local há mais de 20 minutos durante uma ação em andamento. Para continuar,
              tire uma <strong>foto ao vivo pela câmera</strong> comprovando a atividade. Não é permitido anexar
              da galeria.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={openCamera} className="w-full">
              <Camera className="h-4 w-4 mr-2" /> Abrir câmera e tirar foto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
