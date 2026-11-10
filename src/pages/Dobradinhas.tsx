import { useState, useMemo, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDobradinhas } from "@/hooks/useDobradinhas";
import { useCidades, useLiderancas } from "@/hooks/useSupabaseData";
import { useCoordenadores } from "@/hooks/useCoordenadores";
import { useCabosEleitorais } from "@/hooks/useCabosEleitorais";
import { Search, Loader2, Pencil, MapPin, Users, FileDown, X } from "lucide-react";
import { DeleteConfirmDialog } from "@/components/logistics/DeleteConfirmDialog";
import DobradinhaFormDialog from "@/components/DobradinhaFormDialog";
import TsePesquisaPanel from "@/components/TsePesquisaPanel";
import TseComparativoPanel from "@/components/TseComparativoPanel";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { exportTablePdf, exportTableExcel } from "@/lib/exportPdf";

export default function Dobradinhas() {
  const [search, setSearch] = useState("");
  const [filterRegiao, setFilterRegiao] = useState("todas");
  const [filterCoordenador, setFilterCoordenador] = useState("todos");
  const [tsePrefill, setTsePrefill] = useState<{ nome: string; votos: number } | null>(null);
  const { data: dobradinhas = [], isLoading: ld } = useDobradinhas();
  const { data: cidades = [], isLoading: lc } = useCidades();
  const { data: liderancas = [] } = useLiderancas();
  const { data: coordenadores = [], isLoading: lco } = useCoordenadores();
  const { data: cabos = [] } = useCabosEleitorais();
  const queryClient = useQueryClient();

  const cidadeMap = useMemo(() => new Map(cidades.map(c => [c.id, c])), [cidades]);
  const coordenadorMap = useMemo(() => new Map(coordenadores.map(c => [c.user_id, c])), [coordenadores]);
  const liderancaMap = useMemo(() => new Map(liderancas.map(l => [l.id, l])), [liderancas]);
  const caboMap = useMemo(() => new Map(cabos.map(c => [c.id, c])), [cabos]);

  const getVotosEfetivos = useCallback((d: (typeof dobradinhas)[number]) => {
    const pessoa = d.lideranca_id
      ? liderancaMap.get(d.lideranca_id)
      : d.cabo_id ? caboMap.get(d.cabo_id) : null;
    const excluidas = new Set(d.cidades_excluidas || []);
    const cidadeIds = new Set<string>();
    if (d.cidade_id) cidadeIds.add(d.cidade_id);
    if (pessoa?.cidade_base_id) cidadeIds.add(pessoa.cidade_base_id);
    (pessoa?.cidades_representadas || []).forEach(id => cidadeIds.add(id));
    const cidadesVisiveis = [...cidadeIds].filter(id => !excluidas.has(id));
    if (cidadesVisiveis.length === 0) return 0;

    const votosPorCidade = pessoa?.votos_por_cidade;
    if (votosPorCidade && typeof votosPorCidade === "object" && !Array.isArray(votosPorCidade)) {
      const votosDetalhados = cidadesVisiveis.reduce((total, id) => total + Number((votosPorCidade as Record<string, number>)[id] || 0), 0);
      if (votosDetalhados > 0) return votosDetalhados;
    }

    const votosPessoa = pessoa?.votos_estimados;
    return votosPessoa != null && votosPessoa > 0 ? votosPessoa : (d.votos_estimados || 0);
  }, [dobradinhas, liderancaMap, caboMap]);

  const regioes = useMemo(() => {
    const cidadeIds = new Set(dobradinhas.map(d => d.cidade_id));
    const regs = new Set<string>();
    cidadeIds.forEach(id => {
      const r = cidadeMap.get(id)?.regiao_administrativa;
      if (r) regs.add(r);
    });
    return [...regs].sort();
  }, [dobradinhas, cidadeMap]);

  const coordenadoresComDob = useMemo(() => {
    const ids = new Set(dobradinhas.map(d => (d as any).coordenador_user_id).filter(Boolean) as string[]);
    return coordenadores.filter(c => ids.has(c.user_id));
  }, [dobradinhas, coordenadores]);

  const filtered = useMemo(() => dobradinhas.filter(d => {
    if (search) {
      const s = search.toLowerCase();
      if (!d.candidato_parceiro.toLowerCase().includes(s) &&
          !cidadeMap.get(d.cidade_id)?.nome.toLowerCase().includes(s)) return false;
    }
    if (filterRegiao !== "todas") {
      const cidade = cidadeMap.get(d.cidade_id);
      if (cidade?.regiao_administrativa !== filterRegiao) return false;
    }
    if (filterCoordenador !== "todos") {
      if (filterCoordenador === "sem_coordenador") {
        if ((d as any).coordenador_user_id) return false;
      } else if ((d as any).coordenador_user_id !== filterCoordenador) return false;
    }
    return true;
  }), [dobradinhas, search, filterRegiao, filterCoordenador, cidadeMap]);

  // Agrupar por candidato (nome único) com soma de votos e cidades vinculadas
  const agrupado = useMemo(() => {
    const map = new Map<string, { nome: string; cargo: string; cidades: { id: string; nome: string }[]; liderancas: string[]; votos: number; registros: typeof filtered }>();
    filtered.forEach(d => {
      const key = d.candidato_parceiro.trim().toLowerCase();
      const curr = map.get(key) || { nome: d.candidato_parceiro, cargo: d.cargo_parceiro || "", cidades: [], liderancas: [], votos: 0, registros: [] as typeof filtered };
      const cidadesExcluidas = new Set(d.cidades_excluidas || []);

      const addCidade = (id?: string | null) => {
        if (!id || cidadesExcluidas.has(id)) return;
        const nome = cidadeMap.get(id)?.nome;
        if (nome && !curr.cidades.some(c => c.id === id)) curr.cidades.push({ id, nome });
      };

      // Cidade do registro
      addCidade(d.cidade_id);

      // Todas as cidades da liderança vinculada
      if (d.lideranca_id) {
        const lid = liderancaMap.get(d.lideranca_id);
        if (lid) {
          if (!curr.liderancas.includes(lid.nome)) curr.liderancas.push(lid.nome);
          addCidade(lid.cidade_base_id);
          (lid.cidades_representadas || []).forEach(addCidade);
        }
      }

      // Todas as cidades do cabo vinculado
      const caboId = (d as any).cabo_id as string | null;
      if (caboId) {
        const cabo = caboMap.get(caboId);
        if (cabo) {
          if (!curr.liderancas.includes(cabo.nome)) curr.liderancas.push(cabo.nome);
          addCidade(cabo.cidade_base_id);
          (cabo.cidades_representadas || []).forEach(addCidade);
        }
      }

      curr.cidades.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

      curr.votos += getVotosEfetivos(d);
      curr.registros.push(d);
      map.set(key, curr);
    });
    return Array.from(map.values());
  }, [filtered, cidadeMap, liderancaMap, caboMap, getVotosEfetivos]);


  const totalVotos = useMemo(() => agrupado.reduce((s, a) => s + a.votos, 0), [agrupado]);

  async function handleDelete(id: string) {
    const { error } = await supabase.from("dobradinhas").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Dobradinha excluída!");
    queryClient.invalidateQueries({ queryKey: ["dobradinhas"] });
  }

  async function handleRemoveCity(registros: typeof filtered, cidadeId: string, cidadeNome: string) {
    const updates = registros
      .filter(d => !(d.cidades_excluidas || []).includes(cidadeId))
      .map(d => supabase
        .from("dobradinhas")
        .update({ cidades_excluidas: [...(d.cidades_excluidas || []), cidadeId] } as any)
        .eq("id", d.id));

    const results = await Promise.all(updates);
    const error = results.find(result => result.error)?.error;
    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(`${cidadeNome} retirada da Dobrada`);
    queryClient.invalidateQueries({ queryKey: ["dobradinhas"] });
  }

  const reportRows = useMemo(() => {
    return filtered.map(d => {
      const lid = d.lideranca_id ? liderancaMap.get(d.lideranca_id) : null;
      const cabo = (d as any).cabo_id ? caboMap.get((d as any).cabo_id) : null;
      const excluidas = new Set(d.cidades_excluidas || []);
      const nomes: string[] = [];
      const addCidade = (id?: string | null) => {
        if (!id || excluidas.has(id)) return;
        const n = cidadeMap.get(id)?.nome;
        if (n && !nomes.includes(n)) nomes.push(n);
      };
      addCidade(d.cidade_id);
      addCidade(lid?.cidade_base_id);
      (lid?.cidades_representadas || []).forEach(addCidade);
      addCidade(cabo?.cidade_base_id);
      (cabo?.cidades_representadas || []).forEach(addCidade);
      nomes.sort((a, b) => a.localeCompare(b, "pt-BR"));
      const votos = getVotosEfetivos(d);
      return [
        d.candidato_parceiro,
        lid?.nome || cabo?.nome || "—",
        lid?.telefone || cabo?.telefone || "—",
        nomes.join(", ") || "—",
        votos.toLocaleString("pt-BR"),
      ];
    });
  }, [filtered, liderancaMap, caboMap, cidadeMap, getVotosEfetivos]);


  const reportHeaders = ["Dobrada", "Liderança", "Telefone", "Cidade", "Votos Estimados"];

  const handleExportPdf = useCallback(() => {
    exportTablePdf("Relatório Dobrada", reportHeaders, reportRows);
    toast.success("PDF gerado com sucesso!");
  }, [reportRows]);

  const handleExportExcel = useCallback(() => {
    exportTableExcel("Relatório Dobrada", reportHeaders, reportRows);
    toast.success("Excel gerado com sucesso!");
  }, [reportRows]);

  if (ld || lc || lco) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dobrada</h1>
          <p className="text-muted-foreground">Candidatos parceiros por cidade com projeção de votos</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportPdf}>
            <FileDown className="h-4 w-4 mr-1" /> PDF
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportExcel}>
            <FileDown className="h-4 w-4 mr-1" /> Excel
          </Button>
          <DobradinhaFormDialog />
        </div>
        {tsePrefill && (
          <DobradinhaFormDialog
            key={`tse-${tsePrefill.nome}-${tsePrefill.votos}`}
            tsePrefill={tsePrefill}
            trigger={<span />}
            autoOpen
            onSuccess={() => setTsePrefill(null)}
          />
        )}
      </div>

      <TsePesquisaPanel onUsarDobradinha={(nome, votos) => setTsePrefill({ nome, votos })} />
      <TseComparativoPanel />

      <div className="flex flex-col sm:flex-row gap-3">

        <div className="relative max-w-flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por candidato ou cidade..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <NativeSelect
          value={filterRegiao}
          onChange={e => setFilterRegiao(e.target.value)}
          className="w-[200px]"
          options={[
            { value: "todas", label: "Todas as regiões" },
            ...regioes.map(r => ({ value: r, label: r })),
          ]}
        />
        <NativeSelect
          value={filterCoordenador}
          onChange={e => setFilterCoordenador(e.target.value)}
          className="w-[200px]"
          options={[
            { value: "todos", label: "Todos os coordenadores" },
            { value: "sem_coordenador", label: "Sem coordenador" },
            ...coordenadoresComDob.map(c => ({ value: c.user_id, label: c.nome })),
          ]}
        />
      </div>

      {/* Resumo de votos filtrados */}
      <div className="flex flex-wrap gap-3 items-center">
        <Badge variant="outline" className="text-sm px-3 py-1">
          {agrupado.length} dobrada{agrupado.length !== 1 ? 's' : ''}
        </Badge>
        <Badge variant="default" className="text-sm px-3 py-1 font-bold">
          Total Votos: {totalVotos.toLocaleString('pt-BR')}
        </Badge>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
             <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Candidato Parceiro</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Cidades Vinculadas</TableHead>
                  <TableHead>Lideranças</TableHead>
                  <TableHead>Votos Estimados</TableHead>
                  <TableHead className="w-20">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agrupado.map(a => (
                  <TableRow key={a.nome}>
                    <TableCell className="font-medium">{a.nome}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{a.cargo || "—"}</TableCell>
                    <TableCell>
                      {a.cidades.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {a.cidades.map(c => (
                            <Badge key={c.id} variant="outline" className="text-xs gap-1 pr-1">
                              <MapPin className="h-3 w-3" />{c.nome}
                              <DeleteConfirmDialog
                                title="Retirar cidade da Dobrada"
                                description={`Retirar ${c.nome} da Dobrada com "${a.nome}"? A liderança, o coordenador e os demais cadastros serão mantidos.`}
                                onConfirm={() => handleRemoveCity(a.registros, c.id, c.nome)}
                                trigger={
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-5 w-5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                    aria-label={`Retirar ${c.nome} da Dobrada`}
                                    title={`Retirar ${c.nome} da Dobrada`}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                }
                              />
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">Sem cidade</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {a.liderancas.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {a.liderancas.map(l => (
                            <Badge key={l} variant="secondary" className="text-xs gap-1">
                              <Users className="h-3 w-3" />{l}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="default">{a.votos.toLocaleString("pt-BR")}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <DobradinhaFormDialog dobradinha={a.registros[0]} trigger={<Button size="icon" variant="ghost" className="h-8 w-8"><Pencil className="h-3.5 w-3.5" /></Button>} />
                        <DeleteConfirmDialog title="Excluir Dobrada" description={`Deseja excluir a dobrada com "${a.nome}"? Esta ação não pode ser desfeita.`} onConfirm={() => handleDelete(a.registros[0].id)} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {agrupado.length > 0 && (
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell colSpan={4} className="font-bold">TOTAL</TableCell>
                    <TableCell>
                      <Badge variant="default">{totalVotos.toLocaleString("pt-BR")}</Badge>
                    </TableCell>
                    <TableCell />
                  </TableRow>
                )}
                {agrupado.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhuma dobrada cadastrada</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>

  );
}
