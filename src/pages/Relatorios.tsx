import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download, Loader2 } from "lucide-react";
import { useCidades, useLiderancas, useProjecoes, useEstruturas, useVisitas } from "@/hooks/useSupabaseData";
import { useCoordenadores } from "@/hooks/useCoordenadores";
import { useCabosEleitorais } from "@/hooks/useCabosEleitorais";
import { useDobradinhas } from "@/hooks/useDobradinhas";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

type ReportKey = "mapa" | "projecao_cidade" | "projecao_lideranca" | "projecao_coordenador" | "ranking" | "visitas" | "estrutura" | "logistica_estoque";

interface ReportDef {
  key: ReportKey;
  title: string;
  description: string;
}

const reports: ReportDef[] = [
  { key: "mapa", title: "Mapa Eleitoral Completo", description: "Relatório com todas as cidades, projeções e lideranças" },
  { key: "projecao_cidade", title: "Projeção de Votos por Cidade", description: "Detalhamento das projeções e metas por cidade" },
  { key: "projecao_lideranca", title: "Projeção de Votos por Liderança", description: "Desempenho individual de cada liderança" },
  { key: "projecao_coordenador", title: "Projeção de Votos por Coordenador", description: "Coordenador, cidade e total de votos das lideranças vinculadas" },
  { key: "ranking", title: "Ranking de Cidades Estratégicas", description: "Cidades prioritárias por potencial eleitoral" },
  { key: "visitas", title: "Relatório de Visitas", description: "Histórico completo de visitas de campanha" },
  { key: "estrutura", title: "Estrutura Eleitoral", description: "Recursos e infraestrutura por cidade" },
  { key: "logistica_estoque", title: "Relatório de Estoque Logístico", description: "Estoque inicial, atual, distribuído, coordenador e valor de cada material" },
];

function exportCSV(headers: string[], rows: string[][], filename: string) {
  const sep = ";";
  const header = headers.join(sep);
  const lines = rows.map(r => r.map(v => `"${(v ?? "").replace(/"/g, '""')}"`).join(sep));
  const bom = "\uFEFF";
  const csv = bom + [header, ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportExcel(headers: string[], rows: string[][], filename: string) {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Dados");
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

function exportPDF(title: string, headers: string[], rows: string[][], filename: string) {
  const doc = new jsPDF({ orientation: rows[0]?.length > 5 ? "landscape" : "portrait" });
  doc.setFontSize(16);
  doc.text(title, 14, 20);
  doc.setFontSize(10);
  doc.text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")}`, 14, 28);
  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: 34,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [41, 65, 122] },
  });
  doc.save(`${filename}.pdf`);
}

export default function Relatorios() {
  const { data: cidades = [], isLoading: lc } = useCidades();
  const { data: liderancas = [], isLoading: ll } = useLiderancas();
  const { data: projecoes = [], isLoading: lp } = useProjecoes();
  const { data: estruturas = [], isLoading: le } = useEstruturas();
  const { data: visitas = [], isLoading: lv } = useVisitas();
  const { data: dobradinhas = [] } = useDobradinhas();
  const { data: coordenadores = [] } = useCoordenadores();
  const { data: cabos = [] } = useCabosEleitorais();
  const { data: materials = [] } = useQuery({
    queryKey: ["log-materials"],
    queryFn: async () => {
      const { data, error } = await supabase.from("materials" as any).select("*").order("name");
      if (error) throw error;
      return data as any[];
    },
  });
  const { data: movements = [] } = useQuery({
    queryKey: ["log-movements"],
    queryFn: async () => {
      const { data, error } = await supabase.from("movements" as any).select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });
  const [exporting, setExporting] = useState<string | null>(null);

  const isLoading = lc || ll || lp || le || lv;

  const cidadeMap = new Map(cidades.map(c => [c.id, c.nome]));
  const liderancaMap = new Map(liderancas.map(l => [l.id, l.nome]));

  // Build movement summary per material
  const movementSummary = new Map<string, { entradas: number; saidas: number; devolucoes: number }>();
  movements.forEach((m: any) => {
    const existing = movementSummary.get(m.material_id) || { entradas: 0, saidas: 0, devolucoes: 0 };
    if (m.type === "Entrada") existing.entradas += m.quantity;
    else if (m.type === "Saída") existing.saidas += m.quantity;
    else if (m.type === "Devolução") existing.devolucoes += m.quantity;
    movementSummary.set(m.material_id, existing);
  });

  function getReportData(key: ReportKey): { headers: string[]; rows: string[][] } {
    switch (key) {
      case "mapa": {
        const headers = ["Cidade", "População", "Eleitores", "Região", "Lideranças", "Votos Projetados", "Cabos Eleitorais", "Apoiadores"];
        const rows = cidades.map(c => {
          const lids = liderancas.filter(l => l.cidade_base_id === c.id);
          const proj = projecoes.filter(p => p.cidade_id === c.id);
          const est = estruturas.find(e => e.cidade_id === c.id);
          return [
            c.nome,
            String(c.populacao || 0),
            String(c.eleitores || 0),
            c.regiao_administrativa || "-",
            lids.map(l => l.nome).join(", ") || "-",
            String(proj.reduce((s, p) => s + (p.votos_projetados || 0), 0)),
            String(est?.cabos_eleitorais || 0),
            String(est?.apoiadores || 0),
          ];
        });
        return { headers, rows };
      }
      case "projecao_cidade": {
        const headers = ["Cidade", "Votos Projetados", "Votos Confirmados", "Meta", "Confiança", "Responsável"];
        const rows = projecoes.map(p => [
          cidadeMap.get(p.cidade_id) || "-",
          String(p.votos_projetados || 0),
          String(p.votos_confirmados || 0),
          String(p.meta_votos || 0),
          p.nivel_confianca || "-",
          p.responsavel || "-",
        ]);
        return { headers, rows };
      }
      case "projecao_lideranca": {
        const headers = ["Liderança", "Cidade Base", "Votos Estimados", "Força Política", "Status", "Telefone"];
        const rows = liderancas.map(l => [
          l.nome,
          cidadeMap.get(l.cidade_base_id || "") || "-",
          String(l.votos_estimados || 0),
          l.forca_politica,
          l.status,
          l.telefone || "-",
        ]);
        return { headers, rows };
      }
      case "projecao_coordenador": {
        const headers = ["Coordenador", "Cidade", "Votos Líderes", "Votos Cabos", "Total Votos"];
        const lines: string[][] = [];
        let grandTotal = 0;
        // Soma votos de um membro (liderança ou cabo) por cidade,
        // usando votos_por_cidade quando existir, senão cidade base + votos estimados
        const acumular = (membro: any, alvo: Record<string, number>) => {
          const vpc = membro.votos_por_cidade as Record<string, number> | null;
          if (vpc && typeof vpc === "object" && Object.keys(vpc).length > 0) {
            Object.entries(vpc).forEach(([cid, v]) => {
              const n = Number(v) || 0;
              if (n > 0) alvo[cid] = (alvo[cid] || 0) + n;
            });
          } else if (membro.cidade_base_id) {
            const n = Number(membro.votos_estimados) || 0;
            if (n > 0) alvo[membro.cidade_base_id] = (alvo[membro.cidade_base_id] || 0) + n;
          }
        };
        coordenadores.forEach(coord => {
          const votosLideres: Record<string, number> = {};
          const votosCabos: Record<string, number> = {};
          liderancas.filter(l => l.coordenador_user_id === coord.user_id).forEach(l => acumular(l, votosLideres));
          (cabos as any[]).filter(c => c.coordenador_user_id === coord.user_id).forEach(c => acumular(c, votosCabos));
          const cidadeIds = new Set([...Object.keys(votosLideres), ...Object.keys(votosCabos)]);
          if (cidadeIds.size === 0) return;
          let subtotal = 0;
          cidadeIds.forEach(cid => {
            const vl = votosLideres[cid] || 0;
            const vc = votosCabos[cid] || 0;
            lines.push([coord.nome, cidadeMap.get(cid) || "-", String(vl), String(vc), String(vl + vc)]);
            subtotal += vl + vc;
          });
          lines.push([coord.nome, "Subtotal", "", "", String(subtotal)]);
          grandTotal += subtotal;
        });
        lines.push(["TOTAL GERAL", "", "", "", String(grandTotal)]);
        return { headers, rows: lines };
      }
      case "ranking": {
        const headers = ["#", "Cidade", "Eleitores", "Votos Projetados", "% Cobertura", "Lideranças"];
        const sorted = [...cidades].sort((a, b) => (b.eleitores || 0) - (a.eleitores || 0));
        const rows = sorted.map((c, i) => {
          const proj = projecoes.filter(p => p.cidade_id === c.id);
          const totalProj = proj.reduce((s, p) => s + (p.votos_projetados || 0), 0);
          const cobertura = c.eleitores ? ((totalProj / c.eleitores) * 100).toFixed(1) : "0";
          const lids = liderancas.filter(l => l.cidade_base_id === c.id).length;
          return [
            String(i + 1),
            c.nome,
            String(c.eleitores || 0),
            String(totalProj),
            `${cobertura}%`,
            String(lids),
          ];
        });
        return { headers, rows };
      }
      case "visitas": {
        const headers = ["Data", "Cidade", "Liderança", "Objetivo", "Resultado", "Equipe"];
        const rows = visitas.map(v => [
          new Date(v.data_visita).toLocaleDateString("pt-BR"),
          cidadeMap.get(v.cidade_id) || "-",
          liderancaMap.get(v.lideranca_id || "") || "-",
          v.objetivo || "-",
          v.resultado || "-",
          v.equipe_responsavel || "-",
        ]);
        return { headers, rows };
      }
      case "estrutura": {
        const headers = ["Cidade", "Cabos Eleitorais", "Apoiadores", "Veículos", "Materiais Distribuídos"];
        const rows = estruturas.map(e => [
          cidadeMap.get(e.cidade_id) || "-",
          String(e.cabos_eleitorais || 0),
          String(e.apoiadores || 0),
          String(e.veiculos || 0),
          String(e.materiais_distribuidos || 0),
        ]);
        return { headers, rows };
      }
      case "logistica_estoque": {
        const headers = ["Material", "Coordenador", "Cidade", "Estoque Inicial", "Entradas", "Saídas", "Devoluções", "Estoque Atual", "Distribuído", "Valor Unit.", "Valor Total", "Status"];
        const rows = materials.map((m: any) => {
          const summary = movementSummary.get(m.id) || { entradas: 0, saidas: 0, devolucoes: 0 };
          return [
            m.name,
            m.management || "-",
            m.city || "-",
            String(m.total_qty || 0),
            String(summary.entradas),
            String(summary.saidas),
            String(summary.devolucoes),
            String(m.available_qty || 0),
            String(m.distributed_qty || 0),
            `R$ ${Number(m.unit_price || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
            `R$ ${Number(m.total_price || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
            m.status,
          ];
        });
        return { headers, rows };
      }
    }
  }

  function handleExport(report: ReportDef, format: "pdf" | "excel" | "csv") {
    const exportKey = `${report.key}-${format}`;
    setExporting(exportKey);
    try {
      const { headers, rows } = getReportData(report.key);
      if (rows.length === 0) {
        toast.warning("Nenhum dado disponível para este relatório.");
        setExporting(null);
        return;
      }
      const filename = report.title.replace(/\s+/g, "_");
      if (format === "csv") exportCSV(headers, rows, filename);
      else if (format === "excel") exportExcel(headers, rows, filename);
      else exportPDF(report.title, headers, rows, filename);
      toast.success(`${report.title} exportado com sucesso!`);
    } catch (err) {
      toast.error("Erro ao exportar relatório.");
      console.error(err);
    }
    setExporting(null);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Relatórios</h1>
        <p className="text-muted-foreground">Exporte relatórios profissionais da campanha</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {reports.map((r) => (
            <Card key={r.key} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-sm">{r.title}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">{r.description}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex gap-2">
                  {(["pdf", "excel", "csv"] as const).map(fmt => (
                    <Button
                      key={fmt}
                      size="sm"
                      variant="outline"
                      className="text-xs"
                      disabled={exporting !== null}
                      onClick={() => handleExport(r, fmt)}
                    >
                      {exporting === `${r.key}-${fmt}` ? (
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <Download className="h-3 w-3 mr-1" />
                      )}
                      {fmt.toUpperCase()}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
