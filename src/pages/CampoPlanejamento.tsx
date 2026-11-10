import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Loader2, Trash2, ClipboardList, FileDown, FileUp, FileSpreadsheet, FileText, Pencil, Search } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import {
  TIPO_ACAO_OPTIONS, labelTipo,
  useCidadesSelect, useLiderancasSelect, useCoordenadoresSelect,
} from "@/hooks/useCampoActions";
import { exportTablePdf, exportTableExcel } from "@/lib/exportPdf";
import * as XLSX from "xlsx";
import { useRef } from "react";
import { DeleteConfirmDialog } from "@/components/logistics/DeleteConfirmDialog";


type AcaoRow = { id?: string; tipo_acao: string; data_prevista: string; hora_prevista: string; local_previsto: string; participantes_previstos: number };
const hojeIso = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
const emptyAcao = (): AcaoRow => ({ tipo_acao: "panfletagem_semaforo", data_prevista: hojeIso(), hora_prevista: "", local_previsto: "", participantes_previstos: 0 });

function weekRange(d = new Date()) {
  const day = d.getDay(); // 0 dom
  const diff = (day === 0 ? -6 : 1 - day);
  const start = new Date(d); start.setDate(d.getDate() + diff);
  const end = new Date(start); end.setDate(start.getDate() + 6);
  const iso = (x: Date) => x.toISOString().slice(0, 10);
  return { ini: iso(start), fim: iso(end) };
}

export default function CampoPlanejamento() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [openDlg, setOpenDlg] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const wk = weekRange();
  const [form, setForm] = useState({
    semana_inicio: wk.ini, semana_fim: wk.fim,
    coordenador_user_id: "", lideranca_id: "", cidade_id: "",
    bairro_principal: "", bairros_secundarios: "",
    meta_semana: "", equipe_prevista: 0,
  });
  const [acoes, setAcoes] = useState<AcaoRow[]>([emptyAcao()]);
  const [saving, setSaving] = useState(false);
  const [busca, setBusca] = useState("");

  const { data: cidades = [] } = useCidadesSelect();
  const { data: liders = [] } = useLiderancasSelect();
  const { data: coords = [] } = useCoordenadoresSelect();

  const { data: planos = [], isLoading } = useQuery({
    queryKey: ["planejamento-semanal-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("planejamento_semanal")
        .select("*, cidade:cidades(nome), lideranca:liderancas(nome), acoes:acoes_planejadas(id, tipo_acao, data_prevista, hora_prevista, local_previsto, participantes_previstos)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: profilesMap = {} } = useQuery({
    queryKey: ["planejamento-profiles-map"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("user_id, nome");
      if (error) throw error;
      const map: Record<string, string> = {};
      (data || []).forEach((p: any) => { map[p.user_id] = p.nome || "—"; });
      return map;
    },
    staleTime: 5 * 60_000,
  });

  const resetForm = () => {
    const w = weekRange();
    setEditingId(null);
    setForm({ semana_inicio: w.ini, semana_fim: w.fim, coordenador_user_id: "", lideranca_id: "", cidade_id: "", bairro_principal: "", bairros_secundarios: "", meta_semana: "", equipe_prevista: 0 });
    setAcoes([emptyAcao()]);
  };

  function openEdit(p: any) {
    setEditingId(p.id);
    setForm({
      semana_inicio: p.semana_inicio ?? wk.ini,
      semana_fim: p.semana_fim ?? wk.fim,
      coordenador_user_id: p.coordenador_user_id ?? "",
      lideranca_id: p.lideranca_id ?? "",
      cidade_id: p.cidade_id ?? "",
      bairro_principal: p.bairro_principal ?? "",
      bairros_secundarios: (p.bairros_secundarios ?? []).join(", "),
      meta_semana: p.meta_semana ?? "",
      equipe_prevista: p.equipe_prevista ?? 0,
    });
    setAcoes(
      (p.acoes ?? []).length
        ? p.acoes.map((a: any) => ({
            id: a.id,
            tipo_acao: a.tipo_acao,
            data_prevista: a.data_prevista ?? "",
            hora_prevista: a.hora_prevista ? String(a.hora_prevista).slice(0, 5) : "",
            local_previsto: a.local_previsto ?? "",
            participantes_previstos: a.participantes_previstos ?? 0,
          }))
        : [emptyAcao()],
    );
    setOpenDlg(true);
  }

  async function save() {
    if (!form.cidade_id) return toast.error("Selecione o município");
    if (!form.bairro_principal) return toast.error("Informe o bairro principal");
    setSaving(true);
    try {
      const payload = {
        semana_inicio: form.semana_inicio,
        semana_fim: form.semana_fim,
        coordenador_user_id: form.coordenador_user_id || null,
        lideranca_id: form.lideranca_id || null,
        cidade_id: form.cidade_id,
        bairro_principal: form.bairro_principal,
        bairros_secundarios: form.bairros_secundarios.split(",").map((s) => s.trim()).filter(Boolean),
        meta_semana: form.meta_semana || null,
        equipe_prevista: form.equipe_prevista || 0,
      };

      let planoId = editingId;
      if (editingId) {
        const { error } = await supabase.from("planejamento_semanal").update(payload).eq("id", editingId);
        if (error) throw error;
        // Replace ações: delete existing then reinsert current list
        const { error: delErr } = await supabase.from("acoes_planejadas").delete().eq("planejamento_id", editingId);
        if (delErr) throw delErr;
      } else {
        const { data: plano, error } = await supabase
          .from("planejamento_semanal")
          .insert({ ...payload, criado_por_user_id: user?.id })
          .select()
          .single();
        if (error) throw error;
        planoId = plano.id;
      }

      const filtered = acoes.filter((a) => a.tipo_acao);
      if (filtered.length && planoId) {
        const { error: e2 } = await supabase.from("acoes_planejadas").insert(
          filtered.map((a) => ({
            planejamento_id: planoId,
            tipo_acao: a.tipo_acao as any,
            data_prevista: a.data_prevista || hojeIso(),
            hora_prevista: a.hora_prevista || null,
            local_previsto: a.local_previsto || null,
            participantes_previstos: a.participantes_previstos || 0,
          })) as any,
        );
        if (e2) throw e2;
      }
      toast.success(editingId ? "Planejamento atualizado" : "Planejamento criado");
      setOpenDlg(false);
      resetForm();
      setTimeout(() => qc.invalidateQueries({ queryKey: ["planejamento-semanal-list"] }), 150);
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function removePlano(id: string) {
    const { error } = await supabase.from("planejamento_semanal").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Excluído");
    qc.invalidateQueries({ queryKey: ["planejamento-semanal-list"] });
  }


  const fileInputRef = useRef<HTMLInputElement>(null);

  const TEMPLATE_HEADERS = [
    "semana_inicio", "semana_fim", "cidade_nome", "lideranca_nome", "coordenador_nome",
    "bairro_principal", "bairros_secundarios", "meta_semana", "equipe_prevista",
    "acao_tipo", "acao_data", "acao_hora", "acao_local", "acao_participantes",
  ];

  function downloadTemplate() {
    const exemplo = [
      [wk.ini, wk.fim, "São Paulo", "", "", "Centro", "Sé, República", "Foco no comércio", "5",
       "panfletagem_semaforo", wk.ini, "08:00", "Av. Paulista, 1000", "3"],
    ];
    const ws = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, ...exemplo]);
    // Add a sheet listing valid tipo_acao values
    const tipos = XLSX.utils.aoa_to_sheet([["tipo_acao (valor)", "Descrição"], ...TIPO_ACAO_OPTIONS.map((o) => [o.value, o.label])]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Planejamento");
    XLSX.utils.book_append_sheet(wb, tipos, "TiposAcao");
    XLSX.writeFile(wb, "modelo-planejamento-campo.xlsx");
    toast.success("Modelo baixado");
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<any>(ws, { defval: "" });
      if (!rows.length) return toast.error("Planilha vazia");

      // Group by planejamento key (semana + cidade + lideranca + bairro)
      const groups = new Map<string, { plano: any; acoes: any[] }>();
      for (const r of rows) {
        const cidade = cidades.find((c) => c.nome.toLowerCase() === String(r.cidade_nome || "").toLowerCase().trim());
        if (!cidade) { console.warn("Cidade não encontrada:", r.cidade_nome); continue; }
        const lid = r.lideranca_nome ? liders.find((l) => l.nome.toLowerCase() === String(r.lideranca_nome).toLowerCase().trim()) : null;
        const coord = r.coordenador_nome ? coords.find((c) => (c.nome ?? "").toLowerCase() === String(r.coordenador_nome).toLowerCase().trim()) : null;
        const key = `${r.semana_inicio}|${r.semana_fim}|${cidade.id}|${lid?.id ?? ""}|${r.bairro_principal}`;
        if (!groups.has(key)) {
          groups.set(key, {
            plano: {
              semana_inicio: r.semana_inicio,
              semana_fim: r.semana_fim,
              cidade_id: cidade.id,
              lideranca_id: lid?.id ?? null,
              coordenador_user_id: coord?.user_id ?? null,
              bairro_principal: String(r.bairro_principal || "").trim(),
              bairros_secundarios: String(r.bairros_secundarios || "").split(",").map((s: string) => s.trim()).filter(Boolean),
              meta_semana: r.meta_semana || null,
              equipe_prevista: parseInt(r.equipe_prevista) || 0,
              criado_por_user_id: user?.id,
            },
            acoes: [],
          });
        }
        if (r.acao_tipo) {
          groups.get(key)!.acoes.push({
            tipo_acao: String(r.acao_tipo).trim(),
            data_prevista: r.acao_data || null,
            hora_prevista: r.acao_hora || null,
            local_previsto: r.acao_local || null,
            participantes_previstos: parseInt(r.acao_participantes) || 0,
          });
        }
      }

      let ok = 0, fail = 0;
      for (const { plano, acoes } of groups.values()) {
        const { data, error } = await supabase.from("planejamento_semanal").insert(plano).select().single();
        if (error) { fail++; console.error(error); continue; }
        if (acoes.length) {
          const { error: e2 } = await supabase.from("acoes_planejadas").insert(
            acoes.map((a) => ({ ...a, planejamento_id: data.id })) as any,
          );
          if (e2) console.error(e2);
        }
        ok++;
      }
      toast.success(`Importação concluída: ${ok} plano(s)${fail ? `, ${fail} falha(s)` : ""}`);
      qc.invalidateQueries({ queryKey: ["planejamento-semanal-list"] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao importar");
    }
  }

  // Fallback: o join embutido pode vir nulo quando o RLS regional bloqueia a leitura
  // direta de `cidades`/`liderancas`; nesse caso resolvemos pelo id via listas completas.
  const nomeCidade = (p: any) =>
    p.cidade?.nome ?? cidades.find((c: any) => c.id === p.cidade_id)?.nome ?? "—";
  const nomeLideranca = (p: any) =>
    p.lideranca?.nome ?? liders.find((l: any) => l.id === p.lideranca_id)?.nome ?? "—";
  const nomeCoordenador = (p: any) =>
    (p.coordenador_user_id && profilesMap[p.coordenador_user_id]) ||
    (p.criado_por_user_id && profilesMap[p.criado_por_user_id]) ||
    "—";

  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const planosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (!termo) return planos;
    return planos.filter((p: any) => {
      const coord = norm(nomeCoordenador(p));
      const lider = norm(nomeLideranca(p));
      const cidade = norm(nomeCidade(p));
      const bairro = norm(p.bairro_principal || "");
      return coord.includes(termo) || lider.includes(termo) || cidade.includes(termo) || bairro.includes(termo);
    });
  }, [planos, busca, profilesMap, cidades, liders]);

  function buildExportRows() {

    const headers = ["Semana", "Município", "Liderança", "Bairro principal", "Bairros secundários", "Equipe", "Meta", "Ações"];
    const rows = planos.map((p: any) => [
      `${p.semana_inicio} → ${p.semana_fim}`,
      nomeCidade(p),
      nomeLideranca(p),
      p.bairro_principal ?? "—",
      (p.bairros_secundarios ?? []).join(", "),
      String(p.equipe_prevista ?? 0),
      p.meta_semana ?? "—",
      (p.acoes ?? []).map((a: any) => `${labelTipo(a.tipo_acao)}${a.data_prevista ? ` (${a.data_prevista}${a.hora_prevista ? " " + a.hora_prevista : ""})` : ""}`).join(" | ") || "—",
    ]);
    return { headers, rows };
  }

  function exportPdf() {
    const { headers, rows } = buildExportRows();
    if (!rows.length) return toast.error("Nenhum plano para exportar");
    exportTablePdf("Planejamento de Campo", headers, rows);
  }

  function exportXlsx() {
    const { headers, rows } = buildExportRows();
    if (!rows.length) return toast.error("Nenhum plano para exportar");
    exportTableExcel("Planejamento de Campo", headers, rows);
  }

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-primary" /> Planejamento de Campo
          </h1>
          <p className="text-sm text-muted-foreground">Defina as ações planejadas para a semana</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} />
          <Button variant="outline" size="sm" onClick={downloadTemplate}><FileDown className="h-4 w-4 mr-1" />Modelo</Button>
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}><FileUp className="h-4 w-4 mr-1" />Importar</Button>
          <Button variant="outline" size="sm" onClick={exportXlsx}><FileSpreadsheet className="h-4 w-4 mr-1" />Excel</Button>
          <Button variant="outline" size="sm" onClick={exportPdf}><FileText className="h-4 w-4 mr-1" />PDF</Button>
          <Dialog open={openDlg} onOpenChange={(o) => { setOpenDlg(o); if (!o) resetForm(); }}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-1" />Novo plano</Button>
            </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editingId ? "Editar planejamento semanal" : "Novo planejamento semanal"}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><Label>Semana — início</Label><Input type="date" value={form.semana_inicio} onChange={(e) => setForm({ ...form, semana_inicio: e.target.value })} /></div>
              <div><Label>Semana — fim</Label><Input type="date" value={form.semana_fim} onChange={(e) => setForm({ ...form, semana_fim: e.target.value })} /></div>
              <div>
                <Label>Coordenador</Label>
                <NativeSelect placeholder="Selecione" value={form.coordenador_user_id} options={coords.map((c) => ({ value: c.user_id, label: c.nome || "—" }))} onChange={(e) => setForm({ ...form, coordenador_user_id: e.target.value })} />
              </div>
              <div>
                <Label>Liderança</Label>
                <NativeSelect placeholder="Selecione" value={form.lideranca_id} options={liders.map((l) => ({ value: l.id, label: l.nome }))} onChange={(e) => setForm({ ...form, lideranca_id: e.target.value, cidade_id: form.cidade_id || (liders.find(x=>x.id===e.target.value)?.cidade_base_id ?? "") })} />
              </div>
              <div>
                <Label>Município *</Label>
                <NativeSelect placeholder="Selecione" value={form.cidade_id} options={cidades.map((c) => ({ value: c.id, label: c.nome }))} onChange={(e) => setForm({ ...form, cidade_id: e.target.value })} />
              </div>
              <div><Label>Bairro principal *</Label><Input value={form.bairro_principal} onChange={(e) => setForm({ ...form, bairro_principal: e.target.value })} /></div>
              <div className="md:col-span-2"><Label>Bairros secundários (separe por vírgula)</Label><Input value={form.bairros_secundarios} onChange={(e) => setForm({ ...form, bairros_secundarios: e.target.value })} /></div>
              <div className="md:col-span-2"><Label>Meta da semana</Label><Textarea rows={2} value={form.meta_semana} onChange={(e) => setForm({ ...form, meta_semana: e.target.value })} /></div>
              <div><Label>Equipe prevista</Label><Input type="number" min={0} value={form.equipe_prevista} onChange={(e) => setForm({ ...form, equipe_prevista: parseInt(e.target.value) || 0 })} /></div>
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-base">Ações planejadas</Label>
                <Button size="sm" variant="outline" onClick={() => setAcoes([...acoes, emptyAcao()])}><Plus className="h-3 w-3 mr-1" />Adicionar</Button>
              </div>
              <div className="space-y-2">
                {acoes.map((a, i) => (
                  <div key={i} className="grid grid-cols-12 gap-2 items-end border rounded-md p-2">
                    <div className="col-span-12 md:col-span-3">
                      <Label className="text-xs">Tipo</Label>
                      <NativeSelect value={a.tipo_acao} options={TIPO_ACAO_OPTIONS as any} onChange={(e) => { const c=[...acoes]; c[i].tipo_acao=e.target.value; setAcoes(c); }} />
                    </div>
                    <div className="col-span-6 md:col-span-2"><Label className="text-xs">Data</Label><Input type="date" value={a.data_prevista} onChange={(e) => { const c=[...acoes]; c[i].data_prevista=e.target.value; setAcoes(c); }} /></div>
                    <div className="col-span-6 md:col-span-2"><Label className="text-xs">Hora</Label><Input type="time" value={a.hora_prevista} onChange={(e) => { const c=[...acoes]; c[i].hora_prevista=e.target.value; setAcoes(c); }} /></div>
                    <div className="col-span-8 md:col-span-3"><Label className="text-xs">Local</Label><Input value={a.local_previsto} onChange={(e) => { const c=[...acoes]; c[i].local_previsto=e.target.value; setAcoes(c); }} /></div>
                    <div className="col-span-3 md:col-span-1"><Label className="text-xs">Qtd. de pessoas</Label><Input type="number" min={0} value={a.participantes_previstos} onChange={(e) => { const c=[...acoes]; c[i].participantes_previstos=parseInt(e.target.value)||0; setAcoes(c); }} /></div>
                    <div className="col-span-1"><Button variant="ghost" size="icon" onClick={() => setAcoes(acoes.filter((_, idx) => idx !== i))}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setOpenDlg(false)}>Cancelar</Button>
              <Button onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Salvar</Button>
            </DialogFooter>
          </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>Planos cadastrados</CardTitle>
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
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : planosFiltrados.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">{busca ? "Nenhum planejamento encontrado para a busca." : "Nenhum planejamento cadastrado."}</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Semana</TableHead><TableHead>Município</TableHead><TableHead>Liderança</TableHead>
                  <TableHead>Coordenador</TableHead>
                  <TableHead>Bairro</TableHead><TableHead>Equipe</TableHead><TableHead>Ações</TableHead><TableHead></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {planosFiltrados.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="whitespace-nowrap text-xs">{p.semana_inicio} → {p.semana_fim}</TableCell>
                      <TableCell>{nomeCidade(p)}</TableCell>
                      <TableCell>{nomeLideranca(p)}</TableCell>
                      <TableCell className="text-sm">{nomeCoordenador(p)}</TableCell>
                      <TableCell><div className="text-sm">{p.bairro_principal}</div>{p.bairros_secundarios?.length > 0 && <div className="text-xs text-muted-foreground">+ {p.bairros_secundarios.join(", ")}</div>}</TableCell>
                      <TableCell>{p.equipe_prevista}</TableCell>
                      <TableCell><Badge variant="outline">{p.acoes?.length ?? 0}</Badge></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 justify-end">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(p)} title="Editar planejamento"><Pencil className="h-4 w-4" /></Button>
                          <DeleteConfirmDialog title="Excluir planejamento" description="Esta ação removerá o plano e suas ações. A exclusão será registrada na auditoria." onConfirm={() => removePlano(p.id)} />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
