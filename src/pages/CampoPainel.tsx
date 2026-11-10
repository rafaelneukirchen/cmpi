import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart3, MapPin, Clock, CheckCircle2, XCircle, Target, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { labelTipo } from "@/hooks/useCampoActions";
import { useAuth } from "@/hooks/useAuth";
import { DeleteConfirmDialog } from "@/components/logistics/DeleteConfirmDialog";
import { toast } from "sonner";

function weekRange(d = new Date()) {
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  const start = new Date(d); start.setDate(d.getDate() + diff); start.setHours(0,0,0,0);
  const end = new Date(start); end.setDate(start.getDate() + 7);
  return { ini: start.toISOString(), fim: end.toISOString() };
}

export default function CampoPainel() {
  const wk = weekRange();
  const { userRole, isSuperAdmin, user } = useAuth();
  const queryClient = useQueryClient();
  const isAdminGeral = isSuperAdmin || userRole === "admin";
  const canDelete = isSuperAdmin || userRole === "admin" || userRole === "coordenador_estadual" || userRole === "coordenador_regional";

  // Equipe do coordenador logado (para restringir os pins do mapa)
  const { data: equipeIds = [] } = useQuery({
    queryKey: ["painel-equipe-ids", user?.id],
    enabled: !!user?.id && !isAdminGeral,
    queryFn: async () => {
      const { data } = await supabase
        .from("equipe_membros")
        .select("user_id")
        .eq("coordenador_user_id", user!.id);
      return (data ?? []).map((r: any) => r.user_id as string);
    },
  });


  async function handleDelete(id: string) {
    const { error } = await supabase.from("acoes_execucao").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir: " + error.message); return; }
    toast.success("Ação excluída e registrada na auditoria");
    queryClient.invalidateQueries({ queryKey: ["painel-execs-semana"] });
  }


  const { data: planejado = 0 } = useQuery({
    queryKey: ["painel-planejado-semana"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("acoes_planejadas")
        .select("id, data_prevista, planejamento_id, planejamento:planejamento_semanal!inner(semana_inicio, semana_fim)");
      if (error) throw error;
      const now = new Date();
      return (data ?? []).filter((a: any) => {
        const ini = new Date(a.planejamento.semana_inicio);
        const fim = new Date(a.planejamento.semana_fim);
        return ini <= now && now <= fim;
      }).length;
    },
  });

  const { data: execs = [] } = useQuery({
    queryKey: ["painel-execs-semana", wk.ini],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("acoes_execucao")
        .select("*, profile:profiles!acoes_execucao_iniciado_por_user_id_fkey(nome)")
        .gte("iniciado_em", wk.ini)
        .lt("iniciado_em", wk.fim)
        .order("iniciado_em", { ascending: false });
      if (error) {
        // fallback sem join
        const r = await supabase.from("acoes_execucao").select("*").gte("iniciado_em", wk.ini).lt("iniciado_em", wk.fim).order("iniciado_em", { ascending: false });
        return r.data ?? [];
      }
      return data ?? [];
    },
  });

  // Ações em andamento (não encerradas) — SEM filtro de semana, para o mapa
  // mostrar todos os pins ativos mesmo de semanas anteriores.
  const { data: andamento = [] } = useQuery({
    queryKey: ["painel-andamento-map"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("acoes_execucao")
        .select("*, profile:profiles!acoes_execucao_iniciado_por_user_id_fkey(nome)")
        .is("encerrado_em", null)
        .order("iniciado_em", { ascending: false });
      let rows: any[] = data ?? [];
      if (error) {
        const r = await supabase
          .from("acoes_execucao")
          .select("*")
          .is("encerrado_em", null)
          .order("iniciado_em", { ascending: false });
        rows = r.data ?? [];
      }
      if (!rows.length) return [];
      const userIds = [...new Set(rows.map((x: any) => x.iniciado_por_user_id).filter(Boolean))];
      if (!userIds.length) return rows;
      // Resolve o coordenador de cada executor via equipe_membros.
      // Se o executor não tiver vínculo, ele próprio é o coordenador.
      const { data: em } = await supabase
        .from("equipe_membros")
        .select("user_id, coordenador_user_id")
        .in("user_id", userIds);
      const link: Record<string, string> = {};
      (em ?? []).forEach((r: any) => {
        if (r.coordenador_user_id) link[r.user_id] = r.coordenador_user_id;
      });
      const coordIds = new Set<string>();
      userIds.forEach((u: string) => coordIds.add(link[u] ?? u));
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, nome")
        .in("user_id", [...coordIds]);
      const nameMap: Record<string, string> = {};
      (profs ?? []).forEach((p: any) => { nameMap[p.user_id] = p.nome; });
      return rows.map((x: any) => {
        const coordId = link[x.iniciado_por_user_id] ?? x.iniciado_por_user_id;
        return { ...x, coordenador_nome: nameMap[coordId] ?? null };
      });
    },
  });

  const realizadas = execs.filter((e: any) => !!e.encerrado_em);
  const naoFinalizadas = execs.filter((e: any) => !e.encerrado_em);
  const horasCampo = realizadas.reduce((acc: number, e: any) => acc + (new Date(e.encerrado_em).getTime() - new Date(e.iniciado_em).getTime()), 0) / 3_600_000;
  const cumprimento = planejado > 0 ? Math.min(100, Math.round((realizadas.length / planejado) * 100)) : 0;

  // Coordenadas de municípios (fallback quando a ação não capturou GPS)
  const { data: cidadesCoords = [] } = useQuery({
    queryKey: ["painel-cidades-coords"],
    queryFn: async () => {
      const [rpc, tbl] = await Promise.all([
        supabase.rpc("get_mapa_geral_cidades"),
        supabase.from("cidades").select("id, nome, latitude, longitude"),
      ]);
      return [...((rpc.data ?? []) as any[]), ...((tbl.data ?? []) as any[])];
    },
    staleTime: 30 * 60_000,
  });

  const coordsPorCidade = useMemo(() => {
    const byId: Record<string, [number, number]> = {};
    const byNome: Record<string, [number, number]> = {};
    (cidadesCoords as any[]).forEach((c) => {
      const lat = Number(c.latitude);
      const lng = Number(c.longitude);
      if (Number.isFinite(lat) && Number.isFinite(lng) && lat !== 0) {
        byId[c.id] = [lat, lng];
        byNome[String(c.nome ?? "").trim().toLowerCase()] = [lat, lng];
      }
    });
    return { byId, byNome };
  }, [cidadesCoords]);


  // Mapa
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { center: [-22.5, -48.5], zoom: 7, scrollWheelZoom: false });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap" }).addTo(map);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  const visiveis = useMemo(
    () =>
      (andamento as any[]).filter((e: any) =>
        isAdminGeral ||
        e.iniciado_por_user_id === user?.id ||
        equipeIds.includes(e.iniciado_por_user_id)
      ),
    [andamento, isAdminGeral, equipeIds, user?.id],
  );

  const semLocal = visiveis.filter((e: any) => {
    const hasGps = typeof (e.lat_inicio ?? e.lat_fim) === "number";
    const cid = e.cidade_id ? coordsPorCidade.byId[e.cidade_id] : undefined;
    const cnome = coordsPorCidade.byNome[String(e.cidade_execucao ?? "").trim().toLowerCase()];
    return !hasGps && !cid && !cnome;
  }).length;

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const layer = L.layerGroup().addTo(map);
    const bounds: L.LatLngTuple[] = [];
    const escapeHtml = (s: string) => (s ?? "").replace(/[&<>"]/g, (c) => "&#" + c.charCodeAt(0) + ";");
    const first = (n: string) => (n ?? "?").trim().split(/\s+/)[0];
    // Mostra no mapa TODAS as execuções em andamento (não encerradas), mesmo de
    // semanas anteriores. Admin geral vê todos; coordenador vê apenas a própria
    // equipe (e ele mesmo).
    visiveis.forEach((e: any) => {
        let lat = e.lat_inicio ?? e.lat_fim;
        let lng = e.lng_inicio ?? e.lng_fim;
        let aproximado = false;
        if (typeof lat !== "number" || typeof lng !== "number") {
          const fb =
            (e.cidade_id ? coordsPorCidade.byId[e.cidade_id] : undefined) ??
            coordsPorCidade.byNome[String(e.cidade_execucao ?? "").trim().toLowerCase()];
          if (fb) { lat = fb[0]; lng = fb[1]; aproximado = true; }
        }
        const nome = e.profile?.nome ?? "Sem identificação";
        if (typeof lat === "number" && typeof lng === "number") {
          const coord = e.coordenador_nome ?? nome;
          const cor = aproximado ? "#64748b" : "#f59e0b";
          L.circleMarker([lat, lng], { radius: 8, color: cor, fillColor: cor, fillOpacity: aproximado ? 0.5 : 0.85, weight: 2, dashArray: aproximado ? "3" : undefined })
            .bindTooltip(escapeHtml(first(nome)), { permanent: true, direction: "top", offset: [0, -10], className: "campo-pin-label" })
            .bindPopup(
              `<b>${escapeHtml(nome)}</b>` +
              `<br/>Coordenador: <b>${escapeHtml(coord)}</b>` +
              `<br/>${escapeHtml(labelTipo(e.tipo_acao))}` +
              `<br/>${escapeHtml(`${e.bairro_execucao ?? ""} ${e.cidade_execucao ?? ""}`.trim())}` +
              `<br/>Início: ${new Date(e.iniciado_em).toLocaleString("pt-BR")}` +
              (aproximado ? `<br/><i>Localização aproximada (sem GPS) — centro do município</i>` : "")
            )
            .addTo(layer);
          bounds.push([lat, lng]);
        }
      });
    if (bounds.length > 0) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    return () => { layer.remove(); };
  }, [visiveis, coordsPorCidade]);



  function exportCSV() {
    const rows = [["Data", "Tipo", "Município", "Bairro", "Início", "Fim", "Duração (min)", "Participantes", "Distância (m)", "Observações"]];
    realizadas.forEach((e: any) => {
      const dur = (new Date(e.encerrado_em).getTime() - new Date(e.iniciado_em).getTime()) / 60000;
      rows.push([
        new Date(e.iniciado_em).toLocaleDateString("pt-BR"),
        labelTipo(e.tipo_acao),
        e.cidade_execucao ?? "",
        e.bairro_execucao ?? "",
        new Date(e.iniciado_em).toLocaleTimeString("pt-BR"),
        new Date(e.encerrado_em).toLocaleTimeString("pt-BR"),
        Math.round(dur).toString(),
        String(e.participantes_reais ?? 0),
        Math.round(e.distancia_metros ?? 0).toString(),
        (e.observacoes ?? "").replace(/[\r\n;]+/g, " "),
      ]);
    });
    const csv = "\uFEFF" + rows.map((r) => r.join(";")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `relatorio-campo-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><BarChart3 className="h-6 w-6 text-primary" /> Painel de Campo</h1>
          <p className="text-sm text-muted-foreground">Planejado x Executado — semana atual</p>
        </div>
        <Button variant="outline" onClick={exportCSV}><FileDown className="h-4 w-4 mr-1" />Exportar CSV</Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KPI icon={<Target className="h-4 w-4" />} label="Planejado" value={planejado} />
        <KPI icon={<CheckCircle2 className="h-4 w-4 text-green-600" />} label="Executado" value={realizadas.length} />
        <KPI icon={<XCircle className="h-4 w-4 text-amber-600" />} label="Em aberto" value={naoFinalizadas.length} />
        <KPI icon={<Clock className="h-4 w-4" />} label="Horas em campo" value={horasCampo.toFixed(1)} />
        <KPI icon={<BarChart3 className="h-4 w-4" />} label="% cumprimento" value={`${cumprimento}%`} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><MapPin className="h-4 w-4" />Mapa de ações</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {visiveis.length} ação(ões) em andamento
            {semLocal > 0 && ` — ${semLocal} sem localização (GPS não autorizado e município sem coordenadas)`}
          </p>
          <div ref={containerRef} className="w-full h-[420px] rounded-md overflow-hidden border" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Relatório semanal</CardTitle></CardHeader>
        <CardContent>
          {realizadas.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Sem ações executadas na semana.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Data</TableHead><TableHead>Tipo</TableHead><TableHead>Município</TableHead><TableHead>Bairro</TableHead>
                  <TableHead>Início</TableHead><TableHead>Fim</TableHead><TableHead>Duração</TableHead><TableHead>Part.</TableHead><TableHead>Dist.</TableHead>
                  {canDelete && <TableHead className="text-right">Ações</TableHead>}
                </TableRow></TableHeader>
                <TableBody>
                  {realizadas.map((e: any) => {
                    const dur = Math.round((new Date(e.encerrado_em).getTime() - new Date(e.iniciado_em).getTime()) / 60000);
                    return (
                      <TableRow key={e.id}>
                        <TableCell className="text-xs">{new Date(e.iniciado_em).toLocaleDateString("pt-BR")}</TableCell>
                        <TableCell className="text-xs">{labelTipo(e.tipo_acao)}</TableCell>
                        <TableCell className="text-xs">{e.cidade_execucao ?? "—"}</TableCell>
                        <TableCell className="text-xs">{e.bairro_execucao ?? "—"}</TableCell>
                        <TableCell className="text-xs">{new Date(e.iniciado_em).toLocaleTimeString("pt-BR")}</TableCell>
                        <TableCell className="text-xs">{new Date(e.encerrado_em).toLocaleTimeString("pt-BR")}</TableCell>
                        <TableCell className="text-xs">{dur} min</TableCell>
                        <TableCell className="text-xs">{e.participantes_reais ?? 0}</TableCell>
                        <TableCell className="text-xs">{((e.distancia_metros ?? 0) / 1000).toFixed(2)} km</TableCell>
                        {canDelete && (
                          <TableCell className="text-right">
                            <DeleteConfirmDialog
                              title="Excluir ação de campo"
                              description={`Tem certeza que deseja excluir esta ação (${labelTipo(e.tipo_acao)} — ${e.cidade_execucao ?? ""})? A exclusão ficará registrada na auditoria.`}
                              onConfirm={() => handleDelete(e.id)}
                            />
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KPI({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
        <div className="text-2xl font-bold mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}
