import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/logistics/PageHeader";
import { Download, Loader2, ClipboardCheck, FileSpreadsheet, FileText } from "lucide-react";
import { exportStyledExcel } from "@/lib/exportExcelStyled";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";


interface Linha {
  dia: string;
  user_id: string | null;
  nome: string;
  nomes_conferidos: number;
  confirmados: number;
  nao_confirmados: number;
  sem_resposta: number;
  observacoes: number;
  total_acoes: number;
}

const HEADERS = [
  "Data",
  "Operador",
  "Nomes conferidos",
  "Confirmados",
  "Não confirmados",
  "Sem resposta",
  "Observações",
  "Total de ações",
];

function fmtDia(d: string) {
  const [y, m, dd] = d.split("-");
  return `${dd}/${m}/${y}`;
}

function isoDaysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export default function RelatorioConferenciaLeads() {
  const [from, setFrom] = useState(isoDaysAgo(29));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [busca, setBusca] = useState("");

  const { data = [], isLoading } = useQuery({
    queryKey: ["conferencias-leads", from, to],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "get_conferencias_leads_por_dia" as never,
        { p_from: from, p_to: to } as never,
      );
      if (error) throw error;
      return (data ?? []) as unknown as Linha[];
    },
  });

  // Base ampla para os acumulados (dia / semana / mês / total)
  const { data: base = [] } = useQuery({
    queryKey: ["conferencias-leads-acumulado"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "get_conferencias_leads_por_dia" as never,
        { p_from: "2020-01-01", p_to: new Date().toISOString().slice(0, 10) } as never,
      );
      if (error) throw error;
      return (data ?? []) as unknown as Linha[];
    },
  });

  const hoje = new Date().toISOString().slice(0, 10);
  const inicioSemana = isoDaysAgo(6);
  const inicioMes = hoje.slice(0, 7) + "-01";

  const acumulados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const map = new Map<string, { nome: string; dia: number; semana: number; mes: number; total: number }>();
    base
      .filter((r) => (q ? r.nome.toLowerCase().includes(q) : true))
      .forEach((r) => {
        const k = r.user_id || r.nome;
        const cur = map.get(k) || { nome: r.nome, dia: 0, semana: 0, mes: 0, total: 0 };
        const n = r.nomes_conferidos;
        if (r.dia === hoje) cur.dia += n;
        if (r.dia >= inicioSemana) cur.semana += n;
        if (r.dia >= inicioMes) cur.mes += n;
        cur.total += n;
        map.set(k, cur);
      });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [base, busca, hoje, inicioSemana, inicioMes]);

  const totaisAcumulados = useMemo(
    () =>
      acumulados.reduce(
        (acc, r) => ({
          dia: acc.dia + r.dia,
          semana: acc.semana + r.semana,
          mes: acc.mes + r.mes,
          total: acc.total + r.total,
        }),
        { dia: 0, semana: 0, mes: 0, total: 0 },
      ),
    [acumulados],
  );

  const rows = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return q ? data.filter((r) => r.nome.toLowerCase().includes(q)) : data;
  }, [data, busca]);

  const porPessoa = useMemo(() => {
    const map = new Map<string, Linha & { dias: number }>();
    rows.forEach((r) => {
      const k = r.user_id || r.nome;
      const cur = map.get(k);
      if (!cur) {
        map.set(k, { ...r, dias: 1 });
      } else {
        cur.nomes_conferidos += r.nomes_conferidos;
        cur.confirmados += r.confirmados;
        cur.nao_confirmados += r.nao_confirmados;
        cur.sem_resposta += r.sem_resposta;
        cur.observacoes += r.observacoes;
        cur.total_acoes += r.total_acoes;
        cur.dias += 1;
      }
    });
    return Array.from(map.values()).sort((a, b) => b.nomes_conferidos - a.nomes_conferidos);
  }, [rows]);


  const totais = useMemo(
    () =>
      rows.reduce(
        (acc, r) => ({
          nomes: acc.nomes + r.nomes_conferidos,
          conf: acc.conf + r.confirmados,
          nconf: acc.nconf + r.nao_confirmados,
          sem: acc.sem + r.sem_resposta,
          obs: acc.obs + r.observacoes,
        }),
        { nomes: 0, conf: 0, nconf: 0, sem: 0, obs: 0 },
      ),
    [rows],
  );

  const toRow = (r: Linha): (string | number)[] => [
    fmtDia(r.dia),
    r.nome,
    r.nomes_conferidos,
    r.confirmados,
    r.nao_confirmados,
    r.sem_resposta,
    r.observacoes,
    r.total_acoes,
  ];

  const baixarExcel = async () => {
    if (rows.length === 0) {
      toast.error("Nenhum dado no período selecionado");
      return;
    }
    await exportStyledExcel(
      `conferencia-leads-${from}-a-${to}`,
      "Conferência por dia",
      HEADERS.map((h) => ({ header: h })),
      rows.map(toRow),
      `Conferência de Leads por Dia — ${fmtDia(from)} a ${fmtDia(to)}`,
    );
    toast.success("Planilha gerada");
  };

  const baixarCSV = () => {
    if (rows.length === 0) {
      toast.error("Nenhum dado no período selecionado");
      return;
    }
    const sep = ";";
    const csv =
      "\uFEFF" +
      [HEADERS.join(sep), ...rows.map((r) => toRow(r).map((v) => `"${String(v).replace(/"/g, '""')}"`).join(sep))].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `conferencia-leads-${from}-a-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const baixarPDF = () => {
    if (rows.length === 0 && acumulados.length === 0) {
      toast.error("Nenhum dado no período selecionado");
      return;
    }
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(16);
    doc.text("Conferência de Leads", 14, 18);
    doc.setFontSize(10);
    doc.text(`Período: ${fmtDia(from)} a ${fmtDia(to)}`, 14, 25);
    doc.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, 14, 31);

    const azul: [number, number, number] = [30, 45, 80];
    const azulClaro: [number, number, number] = [222, 232, 247];
    const base = {
      margin: { left: 10, right: 10 },
      styles: {
        fontSize: 9,
        cellPadding: 2.5,
        lineColor: [180, 194, 218] as [number, number, number],
        lineWidth: 0.1,
        overflow: "linebreak" as const,
      },
      headStyles: { fillColor: azul, textColor: 255, fontStyle: "bold" as const },
      footStyles: { fillColor: azul, textColor: 255, fontStyle: "bold" as const },
      bodyStyles: { fillColor: [255, 255, 255] as [number, number, number] },
      alternateRowStyles: { fillColor: azulClaro },
    };

    doc.setFontSize(12);
    doc.text("Nomes conferidos — dia, semana, mês e total", 14, 40);
    autoTable(doc, {
      ...base,
      startY: 44,
      head: [["Operador", "Hoje", "Semana (7 dias)", "Mês atual", "Total"]],
      body: acumulados.map((r) => [r.nome, r.dia, r.semana, r.mes, r.total].map(String)),
      foot: [[
        "TOTAL GERAL",
        String(totaisAcumulados.dia),
        String(totaisAcumulados.semana),
        String(totaisAcumulados.mes),
        String(totaisAcumulados.total),
      ]],
    });

    const y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
    doc.setFontSize(12);
    doc.text("Detalhado por dia", 14, y);
    autoTable(doc, {
      ...base,
      startY: y + 4,
      head: [HEADERS],
      body: rows.map((r) => toRow(r).map(String)),
    });

    doc.save(`conferencia-leads-${from}-a-${to}.pdf`);
    toast.success("PDF gerado");
  };

  return (
    <div className="p-4 sm:p-6">
      <PageHeader
        title="Conferência de Leads por Dia"
        description="Apenas operadores com acesso a todos os contatos. Nomes conferidos por dia, semana, mês e total."
      >
        <Button variant="outline" size="sm" className="gap-1.5" onClick={baixarCSV}>
          <Download className="h-4 w-4" /> CSV
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={baixarPDF}>
          <FileText className="h-4 w-4" /> PDF
        </Button>
        <Button size="sm" className="gap-1.5" onClick={baixarExcel}>
          <FileSpreadsheet className="h-4 w-4" /> Excel
        </Button>

      </PageHeader>

      <Card className="mb-4">
        <CardContent className="pt-4 grid gap-3 sm:grid-cols-4">
          <div className="space-y-1">
            <Label className="text-xs">De</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Até</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs">Buscar operador</Label>
            <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome do operador" />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
        {[
          { l: "Nomes conferidos", v: totais.nomes },
          { l: "Confirmados", v: totais.conf },
          { l: "Não confirmados", v: totais.nconf },
          { l: "Sem resposta", v: totais.sem },
          { l: "Observações", v: totais.obs },
        ].map((c) => (
          <Card key={c.l}>
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">{c.l}</p>
              <p className="text-xl font-bold">{c.v}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mb-4">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4" /> Nomes conferidos — dia, semana, mês e total
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-3">Operador</th>
                <th className="py-2 pr-3">Hoje</th>
                <th className="py-2 pr-3">Semana (7 dias)</th>
                <th className="py-2 pr-3">Mês atual</th>
                <th className="py-2 pr-3">Total</th>
              </tr>
            </thead>
            <tbody>
              {acumulados.map((r) => (
                <tr key={r.nome} className="border-b last:border-0">
                  <td className="py-2 pr-3 font-medium">{r.nome}</td>
                  <td className="py-2 pr-3">{r.dia}</td>
                  <td className="py-2 pr-3">{r.semana}</td>
                  <td className="py-2 pr-3">{r.mes}</td>
                  <td className="py-2 pr-3 font-semibold">{r.total}</td>
                </tr>
              ))}
              {acumulados.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-muted-foreground">
                    Nenhum registro.
                  </td>
                </tr>
              )}
            </tbody>
            {acumulados.length > 0 && (
              <tfoot>
                <tr className="border-t font-semibold">
                  <td className="py-2 pr-3">Total geral</td>
                  <td className="py-2 pr-3">{totaisAcumulados.dia}</td>
                  <td className="py-2 pr-3">{totaisAcumulados.semana}</td>
                  <td className="py-2 pr-3">{totaisAcumulados.mes}</td>
                  <td className="py-2 pr-3">{totaisAcumulados.total}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </CardContent>
      </Card>

      {isLoading ? (

        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
        </div>
      ) : (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4" /> Total por pessoa no período
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-3">Operador</th>
                    <th className="py-2 pr-3">Dias ativos</th>
                    <th className="py-2 pr-3">Nomes</th>
                    <th className="py-2 pr-3">Confirmados</th>
                    <th className="py-2 pr-3">Não confirmados</th>
                    <th className="py-2 pr-3">Sem resposta</th>
                    <th className="py-2 pr-3">Observações</th>
                  </tr>
                </thead>
                <tbody>
                  {porPessoa.map((r) => (
                    <tr key={r.user_id || r.nome} className="border-b last:border-0">
                      <td className="py-2 pr-3 font-medium">{r.nome}</td>
                      <td className="py-2 pr-3">{r.dias}</td>
                      <td className="py-2 pr-3">{r.nomes_conferidos}</td>
                      <td className="py-2 pr-3 text-green-700">{r.confirmados}</td>
                      <td className="py-2 pr-3 text-red-700">{r.nao_confirmados}</td>
                      <td className="py-2 pr-3">{r.sem_resposta}</td>
                      <td className="py-2 pr-3 text-amber-700">{r.observacoes}</td>
                    </tr>
                  ))}
                  {porPessoa.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-muted-foreground">
                        Nenhum registro no período.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Detalhado por dia</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    {HEADERS.map((h) => (
                      <th key={h} className="py-2 pr-3 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={`${r.dia}-${r.user_id}-${i}`} className="border-b last:border-0">
                      <td className="py-2 pr-3 whitespace-nowrap">{fmtDia(r.dia)}</td>
                      <td className="py-2 pr-3 font-medium">{r.nome}</td>
                      <td className="py-2 pr-3">{r.nomes_conferidos}</td>
                      <td className="py-2 pr-3 text-green-700">{r.confirmados}</td>
                      <td className="py-2 pr-3 text-red-700">{r.nao_confirmados}</td>
                      <td className="py-2 pr-3">{r.sem_resposta}</td>
                      <td className="py-2 pr-3 text-amber-700">{r.observacoes}</td>
                      <td className="py-2 pr-3">{r.total_acoes}</td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={HEADERS.length} className="py-6 text-center text-muted-foreground">
                        Nenhum registro no período.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
