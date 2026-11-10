import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { NativeSelect } from "@/components/ui/native-select";
import { SearchSelect } from "@/components/ui/search-select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useLiderancas, useCidades } from "@/hooks/useSupabaseData";
import { useCoordenadores } from "@/hooks/useCoordenadores";
import { useCabosEleitorais, useCoordenadoresRegionais } from "@/hooks/useCabosEleitorais";
import { useDobradinhas } from "@/hooks/useDobradinhas";
import { useEleitoresCaptadosCountByLideranca, useEleitoresCaptados } from "@/hooks/useEleitoresCaptados";
import { useTseVotosReferencia, normalizeCidade, ANO_REFERENCIA } from "@/hooks/useTseVotosReferencia";

import { Search, Loader2, Pencil, Download, Users, UserPlus, ChevronDown, ChevronRight, Shield, UserCheck, Megaphone, Plus } from "lucide-react";
import { DeleteConfirmDialog } from "@/components/logistics/DeleteConfirmDialog";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import LiderancaFormDialog from "@/components/LiderancaFormDialog";
import CaboEleitoralFormDialog from "@/components/CaboEleitoralFormDialog";
import MigrarParaCaboDialog from "@/components/MigrarParaCaboDialog";
import PromoverCaboParaLiderDialog from "@/components/PromoverCaboParaLiderDialog";
import ImportLiderancasDialog from "@/components/ImportLiderancasDialog";
import { VotoQrDialog } from "@/components/VotoQrDialog";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

const statusLabels: Record<string, string> = { ativa: 'Ativa', potencial: 'Potencial', em_negociacao: 'Em Negociação' };
const forcaLabels: Record<string, string> = { baixa: 'Baixa', media: 'Média', alta: 'Alta' };

const normalizeText = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

const onlyDigits = (value: unknown) => String(value ?? "").replace(/\D/g, "");

export default function Liderancas() {
  const [search, setSearch] = useState("");
  const [coordenadorFilter, setCoordenadorFilter] = useState<string>("todos");
  const [liderancaFilter, setLiderancaFilter] = useState<string>("todas");
  const [caboFilter, setCaboFilter] = useState<string>("todos");
  const [openCoord, setOpenCoord] = useState(true);
  const [openLideres, setOpenLideres] = useState(true);
  const [openCabos, setOpenCabos] = useState(true);

  const { data: liderancas = [], isLoading: ll } = useLiderancas();
  const { data: cidades = [], isLoading: lc } = useCidades();
  const { data: coordenadores = [] } = useCoordenadores();
  const { data: coordenadoresRegionais = [] } = useCoordenadoresRegionais();
  const { data: cabos = [] } = useCabosEleitorais();
  const { data: dobradinhas = [] } = useDobradinhas();
  const { data: captadosCountMap } = useEleitoresCaptadosCountByLideranca();
  const { data: allCaptados } = useEleitoresCaptados();
  const { data: votosTseMap } = useTseVotosReferencia();
  const { data: rankingLiderMap } = useQuery({

    queryKey: ["captados-ranking-liderancas-map"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_captados_ranking_liderancas" as never);
      if (error) throw error;
      const map = new Map<string, number>();
      for (const r of (data ?? []) as Array<{ user_id: string; total: number | string }>) {
        map.set(r.user_id, Number(r.total) || 0);
      }
      return map;
    },
  });
  const { data: rankingCabosMap } = useQuery({
    queryKey: ["captados-ranking-cabos-map"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_captados_ranking_cabos" as never);
      if (error) throw error;
      const map = new Map<string, number>();
      for (const r of (data ?? []) as Array<{ cabo_id: string; total: number | string }>) {
        map.set(r.cabo_id, Number(r.total) || 0);
      }
      return map;
    },
  });
  const queryClient = useQueryClient();

  const cidadeMap = useMemo(() => new Map(cidades.map(c => [c.id, c])), [cidades]);
  const coordMap = useMemo(() => new Map(coordenadores.map(c => [c.user_id, c])), [coordenadores]);
  const liderMap = useMemo(() => new Map(liderancas.map(l => [l.id, l])), [liderancas]);

  // Dobradinhas por líder
  const dobByLideranca = useMemo(() => {
    const map = new Map<string, { count: number; votos: number; nomes: string[] }>();
    for (const d of dobradinhas) {
      if (!d.lideranca_id) continue;
      const entry = map.get(d.lideranca_id) || { count: 0, votos: 0, nomes: [] };
      entry.count++;
      entry.votos += d.votos_estimados || 0;
      if (!entry.nomes.includes(d.candidato_parceiro)) entry.nomes.push(d.candidato_parceiro);
      map.set(d.lideranca_id, entry);
    }
    return map;
  }, [dobradinhas]);

  // Cabos agrupados por líder
  const cabosByLider = useMemo(() => {
    const m = new Map<string, typeof cabos>();
    for (const c of cabos) {
      const arr = m.get(c.lider_id) || [];
      arr.push(c);
      m.set(c.lider_id, arr);
    }
    return m;
  }, [cabos]);

  // Filtro de Líderes
  const liderancasFiltradas = useMemo(() => {
    const textSearch = normalizeText(search);
    const terms = textSearch.split(" ").filter(Boolean);
    const digitSearch = onlyDigits(search);

    return liderancas.filter(l => {
      const coordinatorName = coordMap.get(l.coordenador_user_id || "")?.nome;
      const cityName = cidadeMap.get(l.cidade_base_id || "")?.nome;
      const searchableText = normalizeText([l.nome, l.telefone, l.whatsapp, coordinatorName, cityName, l.bairros?.join(" ")].join(" "));

      const matchesText = terms.length === 0 || terms.every(term => searchableText.includes(term));
      const matchesPhone = digitSearch.length > 0 && [l.telefone, l.whatsapp].some(phone => onlyDigits(phone).includes(digitSearch));
      const matchesCoord = coordenadorFilter === "todos"
        || (coordenadorFilter === "sem_coordenador" && !l.coordenador_user_id)
        || l.coordenador_user_id === coordenadorFilter;
      const matchesLideranca = liderancaFilter === "todas" || l.id === liderancaFilter;
      const matchesCabo = caboFilter === "todos"
        || (cabos.find(c => c.id === caboFilter)?.lider_id === l.id);

      return (matchesText || matchesPhone || terms.length === 0 && !digitSearch) && matchesCoord && matchesLideranca && matchesCabo;
    });
  }, [cidadeMap, coordMap, coordenadorFilter, liderancaFilter, caboFilter, cabos, liderancas, search]);

  // Filtro de Cabos (segue mesmos filtros aplicáveis)
  const cabosFiltrados = useMemo(() => {
    const textSearch = normalizeText(search);
    const terms = textSearch.split(" ").filter(Boolean);
    const digitSearch = onlyDigits(search);
    return cabos.filter(c => {
      const lider = liderMap.get(c.lider_id);
      const coordId = lider?.coordenador_user_id || "";
      const matchesCoord = coordenadorFilter === "todos"
        || (coordenadorFilter === "sem_coordenador" && !coordId)
        || coordId === coordenadorFilter;
      const matchesLider = liderancaFilter === "todas" || c.lider_id === liderancaFilter;
      const matchesCabo = caboFilter === "todos" || c.id === caboFilter;
      const txt = normalizeText([c.nome, c.telefone, c.whatsapp, lider?.nome, c.bairro].join(" "));
      const matchesText = terms.length === 0 || terms.every(t => txt.includes(t));
      const matchesPhone = digitSearch.length > 0 && [c.telefone, c.whatsapp].some(p => onlyDigits(p).includes(digitSearch));
      return (matchesText || matchesPhone || (terms.length === 0 && !digitSearch)) && matchesCoord && matchesLider && matchesCabo;
    });
  }, [cabos, coordenadorFilter, liderancaFilter, caboFilter, search, liderMap]);

  // Coordenadores regionais filtrados
  const coordsFiltrados = useMemo(() => {
    if (coordenadorFilter === "todos") return coordenadoresRegionais;
    if (coordenadorFilter === "sem_coordenador") return [];
    return coordenadoresRegionais.filter(c => c.user_id === coordenadorFilter);
  }, [coordenadoresRegionais, coordenadorFilter]);

  const liderancaOptions = useMemo(() => {
    const base = liderancas
      .filter(l => coordenadorFilter === "todos"
        || (coordenadorFilter === "sem_coordenador" && !l.coordenador_user_id)
        || l.coordenador_user_id === coordenadorFilter)
      .slice().sort((a, b) => a.nome.localeCompare(b.nome));
    return [{ value: "todas", label: "Todos os Líderes" }, ...base.map(l => ({ value: l.id, label: l.nome }))];
  }, [liderancas, coordenadorFilter]);

  const caboOptions = useMemo(() => {
    const base = cabos
      .filter(c => {
        const lider = liderMap.get(c.lider_id);
        if (coordenadorFilter !== "todos" && coordenadorFilter !== "sem_coordenador"
            && lider?.coordenador_user_id !== coordenadorFilter) return false;
        if (liderancaFilter !== "todas" && c.lider_id !== liderancaFilter) return false;
        return true;
      })
      .slice().sort((a, b) => a.nome.localeCompare(b.nome));
    return [{ value: "todos", label: "Todos os Cabos" }, ...base.map(c => {
      const lider = liderMap.get(c.lider_id);
      return { value: c.id, label: c.nome, hint: lider?.nome };
    })];
  }, [cabos, liderMap, coordenadorFilter, liderancaFilter]);

  const coordenadorOptions = useMemo(() => ([
    { value: "todos", label: "Todos os coordenadores" },
    { value: "sem_coordenador", label: "Sem coordenador" },
    ...coordenadores.slice().sort((a, b) => a.nome.localeCompare(b.nome))
      .map(c => ({ value: c.user_id, label: c.nome })),
  ]), [coordenadores]);

  // Totais
  const totals = useMemo(() => {
    let votosLid = 0, votosDob = 0, votosCab = 0, capt = 0;
    for (const l of liderancasFiltradas) {
      votosLid += l.votos_estimados || 0;
      const d = dobByLideranca.get(l.id);
      if (d) votosDob += d.votos;
      capt += rankingLiderMap?.get(l.id) ?? captadosCountMap?.get(l.id) ?? 0;
    }
    for (const c of cabosFiltrados) votosCab += c.votos_estimados || 0;
    return { votosLid, votosDob, votosCab, capt, total: votosLid + votosDob + votosCab };
  }, [liderancasFiltradas, cabosFiltrados, dobByLideranca, captadosCountMap, rankingLiderMap]);

  function handleExportPDF() {
    const doc = new jsPDF({ orientation: "landscape" });
    const filterLabel = coordenadorFilter === "todos"
      ? "Todos os Coordenadores"
      : coordenadorFilter === "sem_coordenador"
        ? "Sem Coordenador"
        : coordMap.get(coordenadorFilter)?.nome || "Coordenador";

    doc.setFontSize(16);
    doc.text("Líderes — " + filterLabel, 14, 20);
    doc.setFontSize(10);
    doc.text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")}`, 14, 28);

    const headers = ["#", "Líder", "Coordenador", "Cidade Base", "Votos Est.", "Cabos", "Dobradinhas", "Captados", "Total", "Status"];
    const rows = liderancasFiltradas.map((l, i) => {
      const dob = dobByLideranca.get(l.id);
      const captados = rankingLiderMap?.get(l.id) ?? captadosCountMap?.get(l.id) ?? 0;
      const votosEst = l.votos_estimados || 0;
      const cabosLider = cabosByLider.get(l.id) || [];
      const votosCabos = cabosLider.reduce((s, c) => s + (c.votos_estimados || 0), 0);
      const total = votosEst + (dob?.votos || 0) + votosCabos;
      return [
        String(i + 1), l.nome,
        coordMap.get(l.coordenador_user_id || '')?.nome || '-',
        cidadeMap.get(l.cidade_base_id || '')?.nome || '-',
        String(votosEst),
        cabosLider.length ? `${cabosLider.length} (${votosCabos})` : '-',
        dob ? `${dob.count} (${dob.votos})` : '-',
        captados ? String(captados) : '-',
        String(total),
        statusLabels[l.status] || l.status,
      ];
    });
    autoTable(doc, { head: [headers], body: rows, startY: 34, styles: { fontSize: 8, cellPadding: 2 }, headStyles: { fillColor: [41, 65, 122] } });
    doc.save(`Lideres_${filterLabel.replace(/\s+/g, '_')}.pdf`);
    toast.success("PDF exportado!");
  }

  function handleExportExcel() {
    const coordPart = coordenadorFilter === "todos"
      ? "Todos_Coordenadores"
      : coordenadorFilter === "sem_coordenador"
        ? "Sem_Coordenador"
        : (coordMap.get(coordenadorFilter)?.nome || "Coordenador").replace(/\s+/g, "_");

    // Sheet 1: Coordenadores
    const sheet1 = coordsFiltrados.map((c, i) => ({
      "#": i + 1,
      "Coordenador Regional": c.nome,
      "Email": c.email || "",
      "Cidades": c.total_cidades,
      "Líderes": c.total_lideres,
      "Cabos Eleitorais": c.total_cabos,
      "Votos Estimados (total)": c.total_votos_estimados,
    }));

    // Sheet 2: Líderes
    const sheet2 = liderancasFiltradas.map((l, i) => {
      const dob = dobByLideranca.get(l.id);
      const cabosLider = cabosByLider.get(l.id) || [];
      const votosCabos = cabosLider.reduce((s, c) => s + (c.votos_estimados || 0), 0);
      const captados = rankingLiderMap?.get(l.id) ?? captadosCountMap?.get(l.id) ?? 0;
      return {
        "#": i + 1,
        "Líder": l.nome,
        "Coordenador": coordMap.get(l.coordenador_user_id || "")?.nome || "-",
        "Cidade Base": cidadeMap.get(l.cidade_base_id || "")?.nome || "-",
        "Telefone": l.telefone || "",
        "WhatsApp": l.whatsapp || "",
        "Votos Estimados (Líder)": l.votos_estimados || 0,
        "Cabos (qtd)": cabosLider.length,
        "Votos Cabos": votosCabos,
        "Dobradinhas (qtd)": dob?.count || 0,
        "Votos Dobradinhas": dob?.votos || 0,
        "Captados": captados,
        "Total Geral": (l.votos_estimados || 0) + (dob?.votos || 0) + votosCabos,
        "Status": statusLabels[l.status] || l.status,
      };
    });

    // Sheet 3: Cabos Eleitorais
    const sheet3 = cabosFiltrados.map((c, i) => {
      const lider = liderMap.get(c.lider_id);
      return {
        "#": i + 1,
        "Cabo Eleitoral": c.nome,
        "Líder": lider?.nome || "-",
        "Coordenador": coordMap.get(lider?.coordenador_user_id || "")?.nome || "-",
        "Cidade Base": cidadeMap.get(c.cidade_base_id || "")?.nome || "-",
        "Bairro": c.bairro || "",
        "Telefone": c.telefone || "",
        "WhatsApp": c.whatsapp || "",
        "Votos Estimados": c.votos_estimados || 0,
        "Observações": c.observacoes || "",
      };
    });

    // Sheet 4: Líder x Cabos
    const sheet4: any[] = [];
    for (const l of liderancasFiltradas) {
      const cabosLider = cabosByLider.get(l.id) || [];
      if (cabosLider.length === 0) continue;
      for (const c of cabosLider) {
        sheet4.push({
          "Coordenador": coordMap.get(l.coordenador_user_id || "")?.nome || "-",
          "Líder": l.nome,
          "Cabo Eleitoral": c.nome,
          "Cidade": cidadeMap.get(c.cidade_base_id || l.cidade_base_id || "")?.nome || "-",
          "Bairro": c.bairro || "",
          "Telefone": c.telefone || "",
          "Votos Estimados": c.votos_estimados || 0,
        });
      }
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheet1), "Coordenadores");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheet2), "Líderes");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheet3), "Cabos Eleitorais");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheet4), "Líder x Cabos");
    XLSX.writeFile(wb, `Lideres_Cabos_${coordPart}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("Excel exportado!");
  }

  async function handleDeleteLider(id: string, nome: string) {
    const { error } = await supabase.from("liderancas").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Líder "${nome}" excluído`);
    queryClient.invalidateQueries({ queryKey: ["liderancas"] });
    queryClient.invalidateQueries({ queryKey: ["cabos_eleitorais"] });
    queryClient.invalidateQueries({ queryKey: ["dobradinhas"] });
  }

  async function handleDeleteCabo(id: string, nome: string) {
    const { error } = await supabase.from("cabos_eleitorais").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Cabo "${nome}" excluído`);
    queryClient.invalidateQueries({ queryKey: ["cabos_eleitorais"] });
    queryClient.invalidateQueries({ queryKey: ["coordenadores_regionais"] });
  }

  if (ll || lc) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Líderes & Cabos Eleitorais</h1>
          <p className="text-muted-foreground">
            Hierarquia: Coordenador → Líder → Cabo Eleitoral —{" "}
            {coordenadoresRegionais.length} coord., {liderancas.length} líderes, {cabos.length} cabos
          </p>
        </div>
        <div className="flex gap-2">
          <LiderancaFormDialog trigger={<Button size="sm"><Plus className="h-4 w-4 mr-1" />Cadastrar Líder</Button>} />
          <CaboEleitoralFormDialog />
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar nome ou telefone..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <SearchSelect
          value={coordenadorFilter}
          onChange={v => { setCoordenadorFilter(v || "todos"); setLiderancaFilter("todas"); setCaboFilter("todos"); }}
          options={coordenadorOptions}
          placeholder="Coordenador"
          searchPlaceholder="Buscar coordenador..."
          className="w-[220px]"
        />
        <SearchSelect
          value={liderancaFilter}
          onChange={v => { setLiderancaFilter(v || "todas"); setCaboFilter("todos"); }}
          options={liderancaOptions}
          placeholder="Líder"
          searchPlaceholder="Buscar líder..."
          className="w-[220px]"
        />
        <SearchSelect
          value={caboFilter}
          onChange={v => setCaboFilter(v || "todos")}
          options={caboOptions}
          placeholder="Cabo Eleitoral"
          searchPlaceholder="Buscar cabo..."
          className="w-[220px]"
        />
        <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={liderancasFiltradas.length === 0}>
          <Download className="h-4 w-4 mr-2" /> PDF
        </Button>
        <Button variant="outline" size="sm" onClick={handleExportExcel}>
          <Download className="h-4 w-4 mr-2" /> Excel
        </Button>
        <ImportLiderancasDialog />
      </div>

      {/* Totais */}
      <div className="flex flex-wrap gap-2 items-center">
        <Badge variant="outline">{liderancasFiltradas.length} líderes</Badge>
        <Badge variant="outline">{cabosFiltrados.length} cabos</Badge>
        <Badge variant="secondary">Votos Líderes: {totals.votosLid.toLocaleString('pt-BR')}</Badge>
        <Badge variant="secondary">Votos Cabos: {totals.votosCab.toLocaleString('pt-BR')}</Badge>
        <Badge variant="secondary">Dobradinhas: {totals.votosDob.toLocaleString('pt-BR')}</Badge>
        <Badge variant="secondary">Captados: {totals.capt.toLocaleString('pt-BR')}</Badge>
        <Badge variant="default" className="font-bold">Total Geral: {totals.total.toLocaleString('pt-BR')}</Badge>
      </div>

      {/* SEÇÃO 1: COORDENADORES */}
      <Collapsible open={openCoord} onOpenChange={setOpenCoord}>
        <Card>
          <CollapsibleTrigger className="w-full">
            <div className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                <h2 className="font-bold text-lg">Coordenadores Regionais</h2>
                <Badge variant="outline">{coordsFiltrados.length}</Badge>
              </div>
              {openCoord ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              {coordsFiltrados.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Nenhum coordenador regional cadastrado.</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {coordsFiltrados.map(c => (
                    <div key={c.user_id} className="rounded-lg border p-3 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="inline-block w-3 h-3 rounded-full" style={{ background: c.cor || '#888' }} />
                        <p className="font-semibold truncate">{c.nome}</p>
                      </div>
                      <div className="text-xs text-muted-foreground grid grid-cols-2 gap-1">
                        <span>Cidades: <b className="text-foreground">{c.total_cidades}</b></span>
                        <span>Líderes: <b className="text-foreground">{c.total_lideres}</b></span>
                        <span>Cabos: <b className="text-foreground">{c.total_cabos}</b></span>
                        <span>Votos: <b className="text-primary">{c.total_votos_estimados.toLocaleString('pt-BR')}</b></span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* SEÇÃO 2: LÍDERES */}
      <Collapsible open={openLideres} onOpenChange={setOpenLideres}>
        <Card>
          <CollapsibleTrigger className="w-full">
            <div className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-primary" />
                <h2 className="font-bold text-lg">Líderes</h2>
                <Badge variant="outline">{liderancasFiltradas.length}</Badge>
              </div>
              {openLideres ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Coordenador</TableHead>
                      <TableHead>Cidade Base</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead className="text-right">Votos</TableHead>
                      <TableHead className="text-right">Votos {ANO_REFERENCIA}</TableHead>

                      <TableHead className="text-center">Cabos</TableHead>
                      <TableHead className="text-center">Captados</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-40">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {liderancasFiltradas.map((l, i) => {
                      const dob = dobByLideranca.get(l.id);
                      const cabosL = cabosByLider.get(l.id) || [];
                      const captados = rankingLiderMap?.get(l.id) ?? captadosCountMap?.get(l.id) ?? 0;
                      const votosCabos = cabosL.reduce((s, c) => s + (c.votos_estimados || 0), 0);
                      const totalVotos = (l.votos_estimados || 0) + (dob?.votos || 0) + votosCabos;
                      const cidadeNome = cidadeMap.get(l.cidade_base_id || '')?.nome || '';
                      const votos2022 = votosTseMap?.get(normalizeCidade(cidadeNome))?.total ?? null;
                      return (
                        <TableRow key={l.id}>
                          <TableCell className="text-muted-foreground font-mono text-xs">{i + 1}</TableCell>
                          <TableCell className="font-medium">{l.nome}</TableCell>
                          <TableCell className="text-muted-foreground">{coordMap.get(l.coordenador_user_id || '')?.nome || '-'}</TableCell>
                          <TableCell>{cidadeNome || '-'}</TableCell>
                          <TableCell className="text-muted-foreground">{l.telefone || '-'}</TableCell>
                          <TableCell className="text-right font-medium">
                            <div>{totalVotos.toLocaleString('pt-BR')}</div>
                            {votosCabos > 0 && (
                              <div className="text-[10px] text-muted-foreground font-normal">
                                +{votosCabos.toLocaleString('pt-BR')} cabos
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right" title={`Votos na cidade em ${ANO_REFERENCIA}`}>
                            {votos2022 !== null
                              ? <span className="text-muted-foreground">{votos2022.toLocaleString('pt-BR')}</span>
                              : <span className="text-muted-foreground text-xs">—</span>}
                          </TableCell>

                          <TableCell className="text-center">
                            {cabosL.length > 0
                              ? <Badge variant="secondary" title={`${votosCabos.toLocaleString('pt-BR')} votos`}>{cabosL.length}</Badge>
                              : <span className="text-muted-foreground text-xs">—</span>}
                          </TableCell>
                          <TableCell className="text-center">
                            {captados > 0 ? <Badge variant="secondary">{captados}</Badge> : <span className="text-muted-foreground text-xs">—</span>}
                          </TableCell>
                          <TableCell>
                            <Badge variant={l.status === 'ativa' ? 'default' : 'outline'} className="text-xs">{statusLabels[l.status] || l.status}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1 items-center">
                              <CaboEleitoralFormDialog liderIdDefault={l.id} trigger={
                                <Button size="icon" variant="ghost" className="h-7 w-7" title="Adicionar Cabo Eleitoral">
                                  <Megaphone className="h-3.5 w-3.5" />
                                </Button>
                              } />
                              <VotoQrDialog token={(l as any).token_publico} nome={l.nome} />
                              <LiderancaFormDialog lideranca={l} trigger={<Button size="icon" variant="ghost" className="h-7 w-7"><Pencil className="h-3.5 w-3.5" /></Button>} />
                              <MigrarParaCaboDialog lideranca={l} trigger={
                                <Button size="icon" variant="ghost" className="h-7 w-7" title="Migrar para Cabo Eleitoral">
                                  <UserPlus className="h-3.5 w-3.5" />
                                </Button>
                              } />
                              <DeleteConfirmDialog title="Excluir Líder" description={`Excluir "${l.nome}"? Cabos e vínculos deste líder com Dobradas também serão removidos. Os demais cadastros não serão alterados.`} onConfirm={() => handleDeleteLider(l.id, l.nome)} />
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {liderancasFiltradas.length === 0 && (
                      <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground py-8">Nenhum líder encontrado</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* SEÇÃO 3: CABOS ELEITORAIS */}
      <Collapsible open={openCabos} onOpenChange={setOpenCabos}>
        <Card>
          <CollapsibleTrigger className="w-full">
            <div className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-2">
                <Megaphone className="h-5 w-5 text-primary" />
                <h2 className="font-bold text-lg">Cabos Eleitorais</h2>
                <Badge variant="outline">{cabosFiltrados.length}</Badge>
              </div>
              {openCabos ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Líder</TableHead>
                      <TableHead>Coordenador</TableHead>
                      <TableHead>Cidade / Bairro</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead className="text-right">Votos Est.</TableHead>
                      <TableHead className="text-right">Votos {ANO_REFERENCIA}</TableHead>
                      <TableHead className="text-center">Captados</TableHead>
                      <TableHead className="w-24">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cabosFiltrados.map((c, i) => {
                      const lider = liderMap.get(c.lider_id);
                      const coord = coordMap.get(lider?.coordenador_user_id || '');
                      const capt = rankingCabosMap?.get(c.id) || 0;
                      const cidadeNomeCabo = cidadeMap.get(c.cidade_base_id || '')?.nome || cidadeMap.get(lider?.cidade_base_id || '')?.nome || '';
                      const votos2022Cabo = votosTseMap?.get(normalizeCidade(cidadeNomeCabo))?.total ?? null;
                      return (
                        <TableRow key={c.id}>
                          <TableCell className="text-muted-foreground font-mono text-xs">{i + 1}</TableCell>
                          <TableCell className="font-medium">{c.nome}</TableCell>
                          <TableCell className="text-muted-foreground">{lider?.nome || '—'}</TableCell>
                          <TableCell className="text-muted-foreground">{coord?.nome || '-'}</TableCell>
                          <TableCell>
                            <div className="text-sm">{cidadeNomeCabo || '-'}</div>
                            {c.bairro && <div className="text-xs text-muted-foreground">{c.bairro}</div>}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{c.telefone || '-'}</TableCell>
                          <TableCell className="text-right font-medium">{(c.votos_estimados || 0).toLocaleString('pt-BR')}</TableCell>
                          <TableCell className="text-right" title={`Votos na cidade em ${ANO_REFERENCIA}`}>
                            {votos2022Cabo !== null
                              ? <span className="text-muted-foreground">{votos2022Cabo.toLocaleString('pt-BR')}</span>
                              : <span className="text-muted-foreground text-xs">—</span>}
                          </TableCell>

                          <TableCell className="text-center">
                            {capt > 0 ? <Badge variant="secondary">{capt.toLocaleString('pt-BR')}</Badge> : <span className="text-muted-foreground text-xs">0</span>}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1 items-center">
                              <CaboEleitoralFormDialog cabo={c} trigger={<Button size="icon" variant="ghost" className="h-7 w-7"><Pencil className="h-3.5 w-3.5" /></Button>} />
                              <PromoverCaboParaLiderDialog cabo={c} trigger={
                                <Button size="icon" variant="ghost" className="h-7 w-7" title="Promover a Liderança">
                                  <UserPlus className="h-3.5 w-3.5" />
                                </Button>
                              } />
                              <DeleteConfirmDialog title="Excluir Cabo" description={`Excluir "${c.nome}"?`} onConfirm={() => handleDeleteCabo(c.id, c.nome)} />
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {cabosFiltrados.length === 0 && (
                      <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">Nenhum cabo eleitoral cadastrado</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}
