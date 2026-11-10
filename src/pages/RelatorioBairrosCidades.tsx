import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { PageHeader } from "@/components/logistics/PageHeader";
import { Download, MapPin, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface CidadeBairros {
  cidade_id: string;
  cidade_nome: string;
  regiao_administrativa: string | null;
  bairros: string[];
  total_bairros: number;
}

const EXPORT_HEADERS = ["Cidade", "Região Administrativa", "Total de Bairros", "Bairros"];

function toRow(r: CidadeBairros): (string | number)[] {
  return [
    r.cidade_nome,
    r.regiao_administrativa || "-",
    r.total_bairros,
    (r.bairros || []).join(", ") || "-",
  ];
}

function exportCSV(rows: CidadeBairros[], filename: string) {
  const sep = ";";
  const lines = rows.map((r) =>
    toRow(r).map((v) => `"${String(v).replace(/"/g, '""')}"`)
  );
  lines.push([
    `TOTAL (${rows.length} cidades)`,
    "",
    String(rows.reduce((s, r) => s + r.total_bairros, 0)),
    "",
  ]);
  const header = EXPORT_HEADERS.join(sep);
  const csvLines = lines.map((line) => line.join(sep));
  const bom = "\uFEFF";
  const csv = bom + [header, ...csvLines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

async function exportExcel(rows: CidadeBairros[], filename: string) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.created = new Date();

  const HEADER_FILL = "FF1E2D50";

  // Aba índice
  const idx = wb.addWorksheet("Índice", { views: [{ state: "frozen", ySplit: 3 }] });
  idx.columns = [{ width: 40 }, { width: 30 }, { width: 18 }];
  idx.mergeCells(1, 1, 1, 3);
  const t = idx.getCell(1, 1);
  t.value = `Bairros por Cidade (com liderança) — ${new Date().toLocaleDateString("pt-BR")}`;
  t.font = { bold: true, size: 14, color: { argb: HEADER_FILL } };
  idx.getRow(1).height = 24;
  idx.addRow([]);
  const ih = idx.addRow(["Cidade", "Região Administrativa", "Total de Bairros"]);
  ih.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });

  const used = new Set<string>();
  const sheetName = (nome: string) => {
    let base = nome.replace(/[\\/*?:[\]]/g, "-").slice(0, 28) || "Cidade";
    let name = base;
    let i = 2;
    while (used.has(name.toLowerCase())) name = `${base.slice(0, 25)}_${i++}`;
    used.add(name.toLowerCase());
    return name;
  };

  rows.forEach((r, i) => {
    const name = sheetName(r.cidade_nome);
    const row = idx.addRow([r.cidade_nome, r.regiao_administrativa || "-", r.total_bairros]);
    if (i % 2 === 1) {
      row.eachCell((c) => {
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCE6F5" } };
      });
    }

    const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 4 }] });
    ws.columns = [{ width: 8 }, { width: 50 }];
    ws.mergeCells(1, 1, 1, 2);
    const title = ws.getCell(1, 1);
    title.value = r.cidade_nome;
    title.font = { bold: true, size: 14, color: { argb: HEADER_FILL } };
    ws.getRow(1).height = 24;
    ws.mergeCells(2, 1, 2, 2);
    ws.getCell(2, 1).value = `Região: ${r.regiao_administrativa || "-"}  |  Bairros: ${r.total_bairros}`;
    ws.getCell(2, 1).font = { size: 10, color: { argb: "FF64748B" } };
    ws.addRow([]);
    const h = ws.addRow(["#", "Bairro"]);
    h.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
      cell.alignment = { horizontal: "center", vertical: "middle" };
    });
    if ((r.bairros || []).length === 0) {
      ws.addRow(["-", "Nenhum bairro cadastrado"]);
    } else {
      r.bairros.forEach((b, bi) => {
        const br = ws.addRow([bi + 1, b]);
        if (bi % 2 === 1) {
          br.eachCell((c) => {
            c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDCE6F5" } };
          });
        }
      });
    }
    ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4 + Math.max(1, r.bairros.length), column: 2 } };
  });

  const totalRow = idx.addRow([
    `TOTAL (${rows.length} cidades)`,
    "",
    rows.reduce((s, r) => s + r.total_bairros, 0),
  ]);
  totalRow.eachCell((c) => {
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
  });

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  link.click();
  URL.revokeObjectURL(url);
}


function exportPDF(rows: CidadeBairros[], filename: string) {
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(16);
  doc.text("Relatório de Bairros por Cidade", 14, 20);
  doc.setFontSize(10);
  doc.text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")}`, 14, 28);
  doc.text(
    `Cidades: ${rows.length}  |  Total de bairros: ${rows.reduce((s, r) => s + r.total_bairros, 0)}`,
    14,
    34,
  );

  autoTable(doc, {
    head: [EXPORT_HEADERS],
    body: rows.map((r) => toRow(r).map(String)),
    foot: [[
      `TOTAL (${rows.length} cidades)`,
      "",
      String(rows.reduce((s, r) => s + r.total_bairros, 0)),
      "",
    ]],
    startY: 40,
    margin: { left: 10, right: 10 },
    tableWidth: 274,
    rowPageBreak: "auto",
    styles: {
      fontSize: 8,
      cellPadding: 2,
      lineColor: [180, 194, 218],
      lineWidth: 0.1,
      overflow: "linebreak",
      valign: "top",
      minCellHeight: 0,
      cellWidth: "wrap",
    },
    headStyles: { fillColor: [30, 45, 80], textColor: 255, fontStyle: "bold", halign: "left" },
    footStyles: { fillColor: [30, 45, 80], textColor: 255, fontStyle: "bold" },
    bodyStyles: { fillColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [240, 244, 251] },
    columnStyles: {
      0: { cellWidth: 42, fontStyle: "bold" },
      1: { cellWidth: 34 },
      2: { cellWidth: 16, halign: "center" },
      3: { cellWidth: 182 },
    },

  });

  doc.save(`${filename}.pdf`);
}

export default function RelatorioBairrosCidades() {
  const { userRole, loading: authLoading } = useAuth();

  const [regiaoFiltro, setRegiaoFiltro] = useState<string>("todas");
  const [busca, setBusca] = useState("");
  const [apenasComBairros, setApenasComBairros] = useState(false);

  const { data: bairrosData = [], isLoading } = useQuery({
    queryKey: ["bairros-por-cidade"],
    enabled: !authLoading,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_bairros_por_cidade");
      if (error) throw error;
      return (data || []) as CidadeBairros[];
    },
  });

  // Cidades que possuem liderança (base ou representada) — mesma regra do dashboard
  const { data: cidadesLideranca = [], isLoading: loadingLid } = useQuery({
    queryKey: ["cidades-com-lideranca-bairros"],
    enabled: !authLoading,
    queryFn: async () => {
      const [{ data: lids, error: e1 }, { data: opts, error: e2 }] = await Promise.all([
        supabase.from("liderancas").select("cidade_base_id, cidades_representadas"),
        supabase.rpc("get_cidades_options"),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      const ids = new Set<string>();
      (lids || []).forEach((l: any) => {
        if (l.cidade_base_id) ids.add(l.cidade_base_id);
        (l.cidades_representadas || []).forEach((id: string) => id && ids.add(id));
      });
      return ((opts || []) as any[])
        .filter((c) => ids.has(c.id))
        .map((c) => ({
          cidade_id: c.id as string,
          cidade_nome: c.nome as string,
          regiao_administrativa: (c.regiao_administrativa ?? null) as string | null,
        }));
    },
  });

  const cidades: CidadeBairros[] = useMemo(() => {
    const byId = new Map(bairrosData.map((b) => [b.cidade_id, b]));
    return cidadesLideranca
      .map((c) => {
        const b = byId.get(c.cidade_id);
        return {
          cidade_id: c.cidade_id,
          cidade_nome: c.cidade_nome,
          regiao_administrativa: c.regiao_administrativa,
          bairros: b?.bairros || [],
          total_bairros: b?.total_bairros || 0,
        };
      })
      .sort((a, b) => a.cidade_nome.localeCompare(b.cidade_nome, "pt-BR"));
  }, [bairrosData, cidadesLideranca]);

  const regioes = useMemo(
    () =>
      Array.from(new Set(cidades.map((c) => c.regiao_administrativa).filter(Boolean))).sort(),
    [cidades],
  );



  const filtradas = useMemo(() => {
    const termo = busca
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    return cidades.filter((c) => {
      if (apenasComBairros && c.total_bairros === 0) return false;
      if (regiaoFiltro !== "todas" && c.regiao_administrativa !== regiaoFiltro) return false;

      if (termo) {
        const alvo = [c.cidade_nome, c.regiao_administrativa || "", ...(c.bairros || [])]
          .join(" ")
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "");
        if (!alvo.includes(termo)) return false;
      }

      return true;
    });
  }, [cidades, regiaoFiltro, busca, apenasComBairros]);

  const totalCidades = filtradas.length;
  const totalBairros = filtradas.reduce((s, r) => s + r.total_bairros, 0);

  async function handleExport(format: "csv" | "excel" | "pdf") {
    if (filtradas.length === 0) {
      toast.warning("Nenhuma cidade para exportar.");
      return;
    }
    const filename = "Relatorio_Bairros_por_Cidade";
    try {
      if (format === "csv") exportCSV(filtradas, filename);
      else if (format === "excel") await exportExcel(filtradas, filename);
      else exportPDF(filtradas, filename);
      toast.success(`Relatório exportado em ${format.toUpperCase()} (${filtradas.length} cidades).`);
    } catch (err) {
      toast.error("Erro ao exportar relatório.");
      console.error(err);
    }
  }

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (userRole !== "admin") {
    return (
      <div className="space-y-6">
        <PageHeader title="Bairros por Cidade" description="Relatório de cidades com liderança e seus bairros" />
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Acesso restrito a administradores.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bairros por Cidade"
        description="Cidades com liderança cadastrada e seus bairros"
      >
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-2" onClick={() => handleExport("csv")}>
            <Download className="h-4 w-4" /> CSV
          </Button>
          <Button size="sm" variant="outline" className="gap-2" onClick={() => handleExport("excel")}>
            <Download className="h-4 w-4" /> Excel
          </Button>
          <Button size="sm" className="gap-2" onClick={() => handleExport("pdf")}>
            <Download className="h-4 w-4" /> PDF
          </Button>
        </div>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="busca-filter">Busca rápida</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="busca-filter"
                  className="pl-9"
                  placeholder="Cidade, região ou bairro..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="regiao-filter">Região Administrativa</Label>
              <NativeSelect
                id="regiao-filter"
                value={regiaoFiltro}
                onChange={(e) => setRegiaoFiltro(e.target.value)}
                options={[
                  { value: "todas", label: "Todas" },
                  ...regioes.map((r) => ({ value: r as string, label: r as string })),
                ]}
              />
            </div>

            <div className="flex items-end gap-2">
              <label className="flex items-center gap-2 cursor-pointer select-none text-sm font-medium text-foreground">
                <input
                  type="checkbox"
                  checked={apenasComBairros}
                  onChange={(e) => setApenasComBairros(e.target.checked)}
                  className="h-4 w-4 rounded border-input accent-primary"
                />
                Apenas com bairros cadastrados
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading || loadingLid ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Cidades com Liderança</p>
                    <p className="text-3xl font-bold mt-1">{totalCidades.toLocaleString("pt-BR")}</p>
                  </div>
                  <MapPin className="h-8 w-8 text-primary" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total de Bairros Cadastrados</p>
                    <p className="text-3xl font-bold mt-1">{totalBairros.toLocaleString("pt-BR")}</p>
                  </div>
                  <MapPin className="h-8 w-8 text-emerald-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Cidades com liderança ({totalCidades.toLocaleString("pt-BR")})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[600px] overflow-auto">
                <table className="w-full text-sm border-collapse">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-primary text-primary-foreground">
                      <th className="text-left px-3 py-2 font-semibold">Cidade</th>
                      <th className="text-left px-3 py-2 font-semibold">Região</th>
                      <th className="text-center px-3 py-2 font-semibold">Bairros</th>
                      <th className="text-left px-3 py-2 font-semibold">Lista de Bairros</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtradas.map((c, i) => (
                      <tr
                        key={c.cidade_id}
                        className={i % 2 === 1 ? "bg-primary/10" : "bg-background"}
                      >
                        <td className="px-3 py-2 font-medium">{c.cidade_nome}</td>
                        <td className="px-3 py-2 text-muted-foreground">{c.regiao_administrativa || "-"}</td>
                        <td className="px-3 py-2 text-center font-semibold">{c.total_bairros}</td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {(c.bairros || []).join(", ") || "-"}
                        </td>
                      </tr>
                    ))}
                    {filtradas.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                          Nenhuma cidade encontrada nos filtros aplicados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {filtradas.length > 0 && (
                    <tfoot className="sticky bottom-0">
                      <tr className="bg-primary text-primary-foreground font-semibold">
                        <td className="px-3 py-2" colSpan={2}>
                          TOTAL ({totalCidades} cidades)
                        </td>
                        <td className="px-3 py-2 text-center">{totalBairros}</td>
                        <td className="px-3 py-2"></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
