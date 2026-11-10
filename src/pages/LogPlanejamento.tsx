import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Pencil, Save, X, Search, FileDown, Calculator, Users } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { PageHeader } from "@/components/logistics/PageHeader";
import {
  ITENS_MATERIAL,
  FORMULAS_SETTING_KEY,
  type ItemKey,
  type Formulas,
  useMaterialPlanejamento,
  calcularQuantidades,
  zeroQuantidades,
  planoKey,
} from "@/lib/materiaisCampanha";

type Cidade = { id: string; nome: string; populacao: number | null; regiao_administrativa: string | null };
type Coord = { user_id: string; nome: string };

const fmt = (n: number) => n.toLocaleString("pt-BR");

export default function LogPlanejamento() {
  const { userRole } = useAuth();
  const canEdit = ["admin", "coordenador_estadual", "coordenador_regional", "operador_cadastro"].includes(userRole || "");
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [coordSearch, setCoordSearch] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<ItemKey, string>>({} as Record<ItemKey, string>);
  const [saving, setSaving] = useState(false);
  const [formulaOpen, setFormulaOpen] = useState(false);
  const [formulaDraft, setFormulaDraft] = useState<Formulas | null>(null);
  const [savingFormula, setSavingFormula] = useState(false);

  const { data: cidades = [], isLoading: lc } = useQuery({
    queryKey: ["planejamento-cidades"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cidades").select("id, nome, populacao, regiao_administrativa").order("nome");
      if (error) throw error;
      return data as Cidade[];
    },
  });

  const { isLoading: lp, formulas, planoMap, votosPorCidade } = useMaterialPlanejamento();

  // Coordenador(es) por cidade: apenas via liderança ou cabo (representante) — sem vínculo direto
  const { data: coordPorCidade = new Map<string, Coord[]>(), isLoading: lcoord } = useQuery({
    queryKey: ["coordenadores-por-cidade-representantes"],
    queryFn: async () => {
      const [profRes, lidRes, caboRes] = await Promise.all([
        supabase.from("profiles").select("user_id, nome"),
        supabase.from("liderancas").select("coordenador_user_id, coordenador_cidade_id, cidade_base_id, cidades_representadas"),
        supabase.from("cabos_eleitorais").select("coordenador_user_id, cidade_base_id, cidades_representadas"),
      ]);
      const nomes = new Map<string, string>();
      (profRes.data || []).forEach((p: any) => nomes.set(p.user_id, p.nome));
      const map = new Map<string, Map<string, string>>();
      const add = (cidadeId?: string | null, userId?: string | null) => {
        if (!cidadeId || !userId) return;
        const nome = nomes.get(userId);
        if (!nome) return;
        if (!map.has(cidadeId)) map.set(cidadeId, new Map());
        map.get(cidadeId)!.set(userId, nome);
      };
      (lidRes.data || []).forEach((l: any) => {
        add(l.coordenador_cidade_id, l.coordenador_user_id);
        add(l.cidade_base_id, l.coordenador_user_id);
        (l.cidades_representadas || []).forEach((cid: string) => add(cid, l.coordenador_user_id));
      });
      (caboRes.data || []).forEach((c: any) => {
        add(c.cidade_base_id, c.coordenador_user_id);
        (c.cidades_representadas || []).forEach((cid: string) => add(cid, c.coordenador_user_id));
      });
      const out = new Map<string, Coord[]>();
      map.forEach((m, k) => out.set(
        k,
        Array.from(m.entries())
          .map(([user_id, nome]) => ({ user_id, nome }))
          .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
      ));
      return out;
    },
  });

  const coordenadoresLista = useMemo(() => {
    const s = new Set<string>();
    coordPorCidade.forEach(list => list.forEach(c => s.add(c.nome)));
    return Array.from(s).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [coordPorCidade]);

  // Uma linha por cidade + coordenador (cidade com 2 coordenadores aparece 2 vezes)
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const qc = coordSearch.trim().toLowerCase();
    const out: {
      key: string;
      cidade: Cidade;
      coordenador: Coord | null;
      votos_projetados: number;
      quantidades: ReturnType<typeof calcularQuantidades>;
      edited: boolean;
    }[] = [];
    cidades
      .filter(c => !q || c.nome.toLowerCase().includes(q))
      .forEach(c => {
        const votos = votosPorCidade.get(c.id) || 0;
        const coords = coordPorCidade.get(c.id) || [];
        const lista: (Coord | null)[] = coords.length > 0 ? coords : [null];
        lista.forEach(coord => {
          if (qc && !(coord?.nome || "").toLowerCase().includes(qc)) return;
          const plano = planoMap.get(planoKey(c.id, coord?.user_id));
          out.push({
            key: planoKey(c.id, coord?.user_id),
            cidade: c,
            coordenador: coord,
            votos_projetados: votos,
            quantidades: calcularQuantidades(plano, votos, formulas),
            edited: !!plano,
          });
        });
      });
    return out;
  }, [cidades, planoMap, votosPorCidade, formulas, search, coordSearch, coordPorCidade]);


  const totals = useMemo(() => {
    const base = zeroQuantidades();
    let votos = 0;
    rows.forEach(r => {
      votos += r.votos_projetados;
      ITENS_MATERIAL.forEach(i => { base[i.key] += r.quantidades[i.key]; });
    });
    return { ...base, votos };
  }, [rows]);

  function startEdit(row: typeof rows[number]) {
    setEditingId(row.key);
    setDraft(ITENS_MATERIAL.reduce((acc, i) => {
      acc[i.key] = String(row.quantidades[i.key]);
      return acc;
    }, {} as Record<ItemKey, string>));
  }

  async function save(row: typeof rows[number]) {
    setSaving(true);
    try {
      const payload: any = { cidade_id: row.cidade.id, coordenador_user_id: row.coordenador?.user_id ?? null };
      ITENS_MATERIAL.forEach(i => { payload[i.key] = parseInt(draft[i.key]) || 0; });
      const existente = planoMap.get(row.key);
      const { error } = existente
        ? await supabase.from("planejamento_logistico").update(payload).eq("id", existente.id)
        : await supabase.from("planejamento_logistico").insert(payload);
      if (error) throw error;
      toast.success("Planejamento atualizado");
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ["planejamento-logistico"] });
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function resetRow(row: typeof rows[number]) {
    if (!canEdit) return;
    const existente = planoMap.get(row.key);
    if (!existente) return;
    const { error } = await supabase.from("planejamento_logistico").delete().eq("id", existente.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Restaurado para o cálculo automático");
    queryClient.invalidateQueries({ queryKey: ["planejamento-logistico"] });
  }

  async function salvarFormulas() {
    if (!formulaDraft) return;
    setSavingFormula(true);
    try {
      const value = JSON.stringify(formulaDraft);
      const { data: existing } = await supabase.from("app_settings").select("id").eq("key", FORMULAS_SETTING_KEY).maybeSingle();
      if (existing) {
        const { error } = await supabase.from("app_settings").update({ value, updated_at: new Date().toISOString() }).eq("key", FORMULAS_SETTING_KEY);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("app_settings").insert({ key: FORMULAS_SETTING_KEY, value });
        if (error) throw error;
      }
      toast.success("Fórmulas salvas");
      setFormulaOpen(false);
      queryClient.invalidateQueries({ queryKey: ["app-settings"] });
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar fórmulas");
    } finally {
      setSavingFormula(false);
    }
  }

  function exportCsv() {
    const BOM = "\uFEFF";
    const header = ["Cidade", ...ITENS_MATERIAL.map(i => i.label), "Coordenador", "Votos Projetados", "Definido manualmente"].join(";");
    const lines = rows.map(r => [
      r.cidade.nome,
      ...ITENS_MATERIAL.map(i => r.quantidades[i.key]),
      r.coordenador?.nome || "",
      r.votos_projetados,
      r.edited ? "Sim" : "Não",
    ].join(";"));
    const csv = BOM + [header, ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `planejamento-material-campanha-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (lc || lp || lcoord) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Planejamento de Material de Campanha"
        description="Quantidades por cidade que alimentam o itinerário de entrega"
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
        {ITENS_MATERIAL.map(i => (
          <Card key={i.key}>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">{i.label}</div>
              <div className="text-xl font-bold">{fmt(totals[i.key])}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:max-w-2xl">
          <div className="relative w-full sm:max-w-sm">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Buscar cidade..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="relative w-full sm:max-w-sm">
            <Users className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              list="coordenadores-list"
              placeholder="Filtrar por coordenador..."
              value={coordSearch}
              onChange={e => setCoordSearch(e.target.value)}
            />
            <datalist id="coordenadores-list">
              {coordenadoresLista.map(n => <option key={n} value={n} />)}
            </datalist>
            {coordSearch && (
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setCoordSearch("")}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
        <div className="flex gap-2">

          {canEdit && (
            <Button variant="outline" size="sm" onClick={() => { setFormulaDraft(formulas); setFormulaOpen(true); }}>
              <Calculator className="h-4 w-4 mr-1" />Cálculo automático
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={exportCsv}><FileDown className="h-4 w-4 mr-1" />Exportar CSV</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[160px]">Cidade</TableHead>
                  {ITENS_MATERIAL.map(i => (
                    <TableHead key={i.key} className="text-right whitespace-nowrap">{i.short}</TableHead>
                  ))}
                  <TableHead className="min-w-[180px]">Coordenador</TableHead>
                  <TableHead className="w-32">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(r => {
                  const isEditing = editingId === r.key;
                  return (
                    <TableRow key={r.key} className={r.edited ? "bg-primary/5" : ""}>
                      <TableCell className="font-medium">
                        {r.cidade.nome}
                        {r.edited && <span className="ml-2 text-[10px] uppercase tracking-wide text-primary">manual</span>}
                      </TableCell>
                      {ITENS_MATERIAL.map(i => (
                        <TableCell key={i.key} className="text-right">
                          {isEditing ? (
                            <Input
                              type="number"
                              min={0}
                              className="h-8 w-24 text-right"
                              value={draft[i.key] ?? "0"}
                              onChange={e => setDraft(d => ({ ...d, [i.key]: e.target.value }))}
                            />
                          ) : fmt(r.quantidades[i.key])}
                        </TableCell>
                      ))}
                      <TableCell className="text-sm">
                        {r.coordenador
                          ? r.coordenador.nome
                          : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" className="h-8 w-8" disabled={saving} onClick={() => save(r)}><Save className="h-3.5 w-3.5" /></Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingId(null)}><X className="h-3.5 w-3.5" /></Button>
                          </div>
                        ) : canEdit ? (
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => startEdit(r)}><Pencil className="h-3.5 w-3.5" /></Button>
                            {r.edited && (
                              <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={() => resetRow(r)}>Auto</Button>
                            )}
                          </div>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {rows.length === 0 && (
                  <TableRow><TableCell colSpan={ITENS_MATERIAL.length + 3} className="text-center text-muted-foreground py-8">Nenhuma cidade encontrada</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Por padrão todas as cidades começam zeradas e você programa cada item manualmente. Se preferir, ative o
        <strong> cálculo automático</strong> por item (quantidade = votos projetados da cidade × fator). Linhas editadas
        manualmente sempre têm prioridade sobre o cálculo. As quantidades aqui definidas são levadas para o Itinerário de entrega.
      </p>

      <Dialog open={formulaOpen} onOpenChange={setFormulaOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Cálculo automático por item</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Ative o item e defina o fator multiplicador sobre os votos projetados da cidade. Desativado = zero (preenchimento manual).
            </p>
            {formulaDraft && ITENS_MATERIAL.map(i => (
              <div key={i.key} className="flex items-center justify-between gap-3 border rounded-md p-3">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={formulaDraft[i.key].auto}
                    onCheckedChange={v => setFormulaDraft(d => ({ ...d!, [i.key]: { ...d![i.key], auto: v } }))}
                  />
                  <Label className="text-sm">{i.label}</Label>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">votos ×</span>
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    className="h-8 w-24 text-right"
                    disabled={!formulaDraft[i.key].auto}
                    value={String(formulaDraft[i.key].fator)}
                    onChange={e => setFormulaDraft(d => ({ ...d!, [i.key]: { ...d![i.key], fator: Number(e.target.value) || 0 } }))}
                  />
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormulaOpen(false)}>Cancelar</Button>
            <Button onClick={salvarFormulas} disabled={savingFormula}>
              {savingFormula && <Loader2 className="h-4 w-4 animate-spin mr-1" />}Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
