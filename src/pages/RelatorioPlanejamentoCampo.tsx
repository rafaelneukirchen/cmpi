import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { PageHeader } from "@/components/logistics/PageHeader";
import { Download, CalendarRange, Loader2, Search } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { exportStyledExcel } from "@/lib/exportExcelStyled";
import { labelTipo, useCidadesSelect } from "@/hooks/useCampoActions";

interface PlanRow {
  key: string;
  coordenador: string;
  lideranca: string;
  cidade: string;
  data: string;
  acao: string;
  local: string;
  pessoas: number;
  status: string;
  semana: string;
  planejamentoId: string;
}

const HEADERS = ["Coordenador", "Liderança", "Cidade", "Data", "Ação planejada", "Local", "Qtd. pessoas", "Status", "Semana"];

const toRow = (r: PlanRow): (string | number)[] => [
  r.coordenador, r.lideranca, r.cidade, r.data, r.acao, r.local, r.pessoas, r.status, r.semana,
];

const fmt = (d?: string | null) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR") : "-");

async function exportExcel(rows: PlanRow[]) {
  const data = rows.map(toRow);
  const planos = new Set(rows.map((r) => r.planejamentoId)).size;
  data.push([`TOTAL: ${planos} planejamento(s) · ${rows.length} ação(ões)`, "", "", "", "", "", rows.reduce((s, r) => s + r.pessoas, 0), "", ""]);
  await exportStyledExcel(
    `planejamento-campo-${new Date().toISOString().slice(0, 10)}`,
    "Planejamento de Campo",
    HEADERS.map((h, i) => ({ header: h, width: [28, 28, 24, 14, 30, 30, 14, 16, 24][i] })),
    data,
    `Relatório de Planejamento de Campo — ${new Date().toLocaleDateString("pt-BR")}`,
  );
}

function exportPDF(rows: PlanRow[]) {
  const planos = new Set(rows.map((r) => r.planejamentoId)).size;
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(16);
  doc.text("Relatório de Planejamento de Campo", 14, 20);
  doc.setFontSize(10);
  doc.text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")}`, 14, 28);
  doc.text(`Planejamentos: ${planos}  |  Ações planejadas: ${rows.length}  |  Pessoas previstas: ${rows.reduce((s, r) => s + r.pessoas, 0)}`, 14, 34);
  autoTable(doc, {
    head: [HEADERS],
    body: rows.map((r) => toRow(r).map(String)),
    startY: 40,
    styles: { fontSize: 8, cellPadding: 2, lineColor: [180, 194, 218], lineWidth: 0.1 },
    headStyles: { fillColor: [30, 45, 80], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [220, 230, 245] },
  });
  doc.save(`planejamento-campo-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export default function RelatorioPlanejamentoCampo() {
  const { session, loading: authLoading } = useAuth();
  const { data: cidadesOpt = [] } = useCidadesSelect();
  const [coordFiltro, setCoordFiltro] = useState("todos");
  const [cidadeFiltro, setCidadeFiltro] = useState("todas");
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [busca, setBusca] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["relatorio-planejamento-campo", session?.user?.id],
    enabled: !authLoading && !!session,
    queryFn: async () => {
      const [planRes, acoesRes, lidRes, profRes] = await Promise.all([
        supabase.from("planejamento_semanal").select("*").order("created_at", { ascending: false }),
        supabase.from("acoes_planejadas").select("*"),
        supabase.from("liderancas").select("id, nome"),
        supabase.from("profiles").select("user_id, nome"),
      ]);
      if (planRes.error) throw planRes.error;
      return {
        planos: (planRes.data ?? []) as any[],
        acoes: (acoesRes.data ?? []) as any[],
        liderancas: (lidRes.data ?? []) as { id: string; nome: string }[],
        profiles: (profRes.data ?? []) as { user_id: string; nome: string }[],
      };
    },
  });

  const rows = useMemo<PlanRow[]>(() => {
    if (!data) return [];
    const nomeLider = new Map(data.liderancas.map((l) => [l.id, l.nome]));
    const nomeProf = new Map(data.profiles.map((p) => [p.user_id, p.nome]));
    const nomeCidade = new Map(cidadesOpt.map((c) => [c.id, c.nome]));
    const acoesPorPlano = new Map<string, any[]>();
    for (const a of data.acoes) {
      const arr = acoesPorPlano.get(a.planejamento_id) ?? [];
      arr.push(a);
      acoesPorPlano.set(a.planejamento_id, arr);
    }
    const out: PlanRow[] = [];
    for (const p of data.planos) {
      const base = {
        coordenador: (p.coordenador_user_id && nomeProf.get(p.coordenador_user_id)) || (p.criado_por_user_id && nomeProf.get(p.criado_por_user_id)) || "-",
        lideranca: (p.lideranca_id && nomeLider.get(p.lideranca_id)) || "-",
        cidade: (p.cidade_id && nomeCidade.get(p.cidade_id)) || "-",
        status: p.status || "-",
        semana: `${fmt(p.semana_inicio)} a ${fmt(p.semana_fim)}`,
        planejamentoId: p.id as string,
      };
      const acoes = acoesPorPlano.get(p.id) ?? [];
      if (!acoes.length) {
        out.push({ ...base, key: p.id, data: fmt(p.semana_inicio), acao: "Sem ação cadastrada", local: p.bairro_principal || "-", pessoas: p.equipe_prevista ?? 0 });
        continue;
      }
      for (const a of acoes) {
        out.push({
          ...base,
          key: a.id,
          data: fmt(a.data_prevista),
          acao: labelTipo(a.tipo_acao),
          local: a.local_previsto || p.bairro_principal || "-",
          pessoas: a.participantes_previstos ?? 0,
        });
      }
    }
    return out;
  }, [data, cidadesOpt]);

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const planosById = new Map((data?.planos ?? []).map((p: any) => [p.id, p]));
    return rows.filter((r) => {
      const p = planosById.get(r.planejamentoId);
      if (coordFiltro !== "todos" && r.coordenador !== coordFiltro) return false;
      if (cidadeFiltro !== "todas" && p?.cidade_id !== cidadeFiltro) return false;
      if (de || ate) {
        const iso = p?.semana_inicio as string | undefined;
        const alvo = r.data !== "-" ? r.data.split("/").reverse().join("-") : iso;
        if (!alvo) return false;
        if (de && alvo < de) return false;
        if (ate && alvo > ate) return false;
      }
      if (termo) {
        const t = `${r.coordenador} ${r.lideranca} ${r.cidade} ${r.acao} ${r.local}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (!t.includes(termo)) return false;
      }
      return true;
    });
  }, [rows, data, coordFiltro, cidadeFiltro, de, ate, busca]);

  const coordOptions = useMemo(
    () => [{ value: "todos", label: "Todos os coordenadores" }, ...Array.from(new Set(rows.map((r) => r.coordenador))).sort().map((n) => ({ value: n, label: n }))],
    [rows],
  );

  const totalPlanos = new Set(filtradas.map((r) => r.planejamentoId)).size;
  const totalPessoas = filtradas.reduce((s, r) => s + r.pessoas, 0);

  return (
    <div className="space-y-6 max-w-7xl">
      <PageHeader title="Relatório de Planejamento de Campo" description="Planejamentos por coordenador, data, cidade e ação planejada">
        <div className="flex gap-2">
          <Button className="gap-2" onClick={() => exportPDF(filtradas)} disabled={!filtradas.length}>
            <Download className="w-4 h-4" /> PDF
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => exportExcel(filtradas)} disabled={!filtradas.length}>
            <Download className="w-4 h-4" /> Excel
          </Button>
        </div>
      </PageHeader>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Planejamentos", value: totalPlanos },
          { label: "Ações planejadas", value: filtradas.length },
          { label: "Pessoas previstas", value: totalPessoas },
        ].map((c) => (
          <Card key={c.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{c.value.toLocaleString("pt-BR")}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="pt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="space-y-1.5">
            <Label>Coordenador</Label>
            <NativeSelect value={coordFiltro} onChange={(e) => setCoordFiltro(e.target.value)} options={coordOptions} />
          </div>
          <div className="space-y-1.5">
            <Label>Cidade</Label>
            <NativeSelect
              value={cidadeFiltro}
              onChange={(e) => setCidadeFiltro(e.target.value)}
              options={[{ value: "todas", label: "Todas as cidades" }, ...cidadesOpt.map((c) => ({ value: c.id, label: c.nome }))]}
            />
          </div>
          <div className="space-y-1.5">
            <Label>De</Label>
            <Input type="date" value={de} onChange={(e) => setDe(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Até</Label>
            <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Buscar</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="Ação, local, liderança..." value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarRange className="w-4 h-4 text-primary" /> {filtradas.length} ação(ões)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
            </div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    {HEADERS.map((h) => (
                      <th key={h} className="py-2 pr-3 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtradas.map((r) => (
                    <tr key={r.key} className="border-b last:border-0">
                      <td className="py-2 pr-3 font-medium">{r.coordenador}</td>
                      <td className="py-2 pr-3">{r.lideranca}</td>
                      <td className="py-2 pr-3">{r.cidade}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">{r.data}</td>
                      <td className="py-2 pr-3">{r.acao}</td>
                      <td className="py-2 pr-3 text-muted-foreground">{r.local}</td>
                      <td className="py-2 pr-3 text-right">{r.pessoas}</td>
                      <td className="py-2 pr-3 capitalize">{r.status}</td>
                      <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground">{r.semana}</td>
                    </tr>
                  ))}
                  {!filtradas.length && (
                    <tr>
                      <td colSpan={HEADERS.length} className="py-8 text-center text-muted-foreground">Nenhum planejamento encontrado</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
