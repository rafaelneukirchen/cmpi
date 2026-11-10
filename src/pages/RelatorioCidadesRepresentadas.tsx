import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCoordenadores } from "@/hooks/useCoordenadores";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { PageHeader } from "@/components/logistics/PageHeader";
import { Download, MapPin, Users, UserCheck, UserCircle, Building2, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { exportStyledExcel } from "@/lib/exportExcelStyled";


interface CidadeRepresentante {
  cidade_id: string;
  cidade_nome: string;
  regiao_administrativa: string | null;
  tem_coordenador: boolean;
  tem_lider: boolean;
  tem_cabo: boolean;
  coordenador_ids: string[] | null;
  coordenador_nomes: string[] | null;
  lider_count: number;
  cabo_count: number;
}

type TipoRepresentante = "todos" | "coordenador" | "lider" | "cabo";

function exportCSV(rows: CidadeRepresentante[], filename: string) {
  const sep = ";";
  const lines = rows.map((r) => toRow(r).map(String));
  lines.push([
    `TOTAL (${rows.length} cidades com representante)`,
    "",
    "",
    "",
    "",
    String(rows.reduce((s, r) => s + r.lider_count, 0)),
    String(rows.reduce((s, r) => s + r.cabo_count, 0)),
    String(rows.reduce((s, r) => s + (r.coordenador_nomes?.length || 0) + r.lider_count + r.cabo_count, 0)),
    "",
  ]);
  const header = EXPORT_HEADERS.join(sep);

  const csvLines = lines.map((line) =>
    line.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(sep)
  );
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

const EXPORT_HEADERS = [
  "Cidade",
  "Região Administrativa",
  "Tem Coordenador",
  "Tem Líder",
  "Tem Cabo",
  "Líderes",
  "Cabos",
  "Total Representantes",
  "Coordenadores",
];

function toRow(r: CidadeRepresentante): (string | number)[] {
  return [
    r.cidade_nome,
    r.regiao_administrativa || "-",
    r.tem_coordenador ? "Sim" : "Não",
    r.tem_lider ? "Sim" : "Não",
    r.tem_cabo ? "Sim" : "Não",
    r.lider_count,
    r.cabo_count,
    (r.coordenador_nomes?.length || 0) + r.lider_count + r.cabo_count,
    (r.coordenador_nomes || []).join(", ") || "-",
  ];
}

async function exportExcel(rows: CidadeRepresentante[], filename: string) {
  const data = rows.map(toRow);
  const totalLideres = rows.reduce((s, r) => s + r.lider_count, 0);
  const totalCabos = rows.reduce((s, r) => s + r.cabo_count, 0);
  const totalCoord = rows.reduce((s, r) => s + (r.coordenador_nomes?.length || 0), 0);
  data.push([
    `TOTAL (${rows.length} cidades com representante)`,
    "",
    "",
    "",
    "",
    totalLideres,
    totalCabos,
    totalCoord + totalLideres + totalCabos,
    "",
  ]);
  await exportStyledExcel(
    filename,
    "Cidades Representadas",
    [
      { header: EXPORT_HEADERS[0], width: 32 },
      { header: EXPORT_HEADERS[1], width: 28 },
      { header: EXPORT_HEADERS[2], width: 16 },
      { header: EXPORT_HEADERS[3], width: 14 },
      { header: EXPORT_HEADERS[4], width: 14 },
      { header: EXPORT_HEADERS[5], width: 12 },
      { header: EXPORT_HEADERS[6], width: 12 },
      { header: EXPORT_HEADERS[7], width: 20 },
      { header: EXPORT_HEADERS[8], width: 45 },
    ],
    data,
    `Relatório de Cidades com Representantes — ${new Date().toLocaleDateString("pt-BR")}`,
  );
}

function exportPDF(rows: CidadeRepresentante[], filename: string) {
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(16);
  doc.text("Relatório de Cidades com Representantes", 14, 20);
  doc.setFontSize(10);
  doc.text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")}`, 14, 28);

  const totalLideres = rows.reduce((s, r) => s + r.lider_count, 0);
  const totalCabos = rows.reduce((s, r) => s + r.cabo_count, 0);
  const totalCoord = rows.reduce((s, r) => s + (r.coordenador_nomes?.length || 0), 0);
  doc.text(
    `Cidades com representante: ${rows.length}  |  Coordenadores: ${totalCoord}  |  Líderes: ${totalLideres}  |  Cabos: ${totalCabos}`,
    14,
    34,
  );

  autoTable(doc, {
    head: [["Cidade", "Região", "Coord.", "Líder", "Cabo", "Líderes", "Cabos", "Total", "Coordenadores"]],
    body: rows.map((r) => toRow(r).map(String)),
    foot: [[
      `TOTAL (${rows.length} cidades)`,
      "",
      "",
      "",
      "",
      String(totalLideres),
      String(totalCabos),
      String(totalCoord + totalLideres + totalCabos),
      "",
    ]],
    startY: 40,
    styles: { fontSize: 8, cellPadding: 2, lineColor: [180, 194, 218], lineWidth: 0.1 },
    headStyles: { fillColor: [30, 45, 80], textColor: 255, fontStyle: "bold" },
    footStyles: { fillColor: [30, 45, 80], textColor: 255, fontStyle: "bold" },
    bodyStyles: { fillColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [220, 230, 245] },
  });
  doc.save(`${filename}.pdf`);
}


export default function RelatorioCidadesRepresentadas() {
  const { userRole, loading: authLoading } = useAuth();
  const { data: coordenadores = [] } = useCoordenadores();

  const [coordenadorFiltro, setCoordenadorFiltro] = useState<string>("todos");
  const [regiaoFiltro, setRegiaoFiltro] = useState<string>("todas");
  const [tipoFiltro, setTipoFiltro] = useState<TipoRepresentante>("todos");
  const [busca, setBusca] = useState("");

  const { data: cidades = [], isLoading } = useQuery({
    queryKey: ["cidades-representantes"],
    enabled: userRole === "admin" && !authLoading,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_cidades_representantes");
      if (error) throw error;
      return (data || []) as CidadeRepresentante[];
    },
  });

  const regioes = useMemo(
    () => Array.from(new Set(cidades.map((c) => c.regiao_administrativa).filter(Boolean))).sort(),
    [cidades]
  );

  const filtradas = useMemo(() => {
    const termo = busca
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    return cidades.filter((c) => {
      if (regiaoFiltro !== "todas" && c.regiao_administrativa !== regiaoFiltro) return false;

      if (coordenadorFiltro !== "todos") {
        const ids = c.coordenador_ids || [];
        if (!ids.includes(coordenadorFiltro)) return false;
      }

      if (tipoFiltro === "coordenador" && !c.tem_coordenador) return false;
      if (tipoFiltro === "lider" && !c.tem_lider) return false;
      if (tipoFiltro === "cabo" && !c.tem_cabo) return false;

      if (termo) {
        const alvo = [c.cidade_nome, c.regiao_administrativa || "", ...(c.coordenador_nomes || [])]
          .join(" ")
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "");
        if (!alvo.includes(termo)) return false;
      }

      return true;
    });
  }, [cidades, regiaoFiltro, coordenadorFiltro, tipoFiltro, busca]);


  const totalCidades = filtradas.length;
  const comRepresentantes = filtradas.filter(
    (c) => c.tem_coordenador || c.tem_lider || c.tem_cabo
  ).length;
  const comCoordenador = filtradas.filter((c) => c.tem_coordenador).length;
  const comLider = filtradas.filter((c) => c.tem_lider).length;
  const comCabo = filtradas.filter((c) => c.tem_cabo).length;
  const semRepresentante = totalCidades - comRepresentantes;

  const listaComRepresentante = useMemo(
    () => filtradas.filter((c) => c.tem_coordenador || c.tem_lider || c.tem_cabo),
    [filtradas]
  );
  const totalCoordenadoresGeral = listaComRepresentante.reduce(
    (s, r) => s + (r.coordenador_nomes?.length || 0), 0
  );
  const totalLideresGeral = listaComRepresentante.reduce((s, r) => s + r.lider_count, 0);
  const totalCabosGeral = listaComRepresentante.reduce((s, r) => s + r.cabo_count, 0);
  const totalRepresentantesGeral = totalCoordenadoresGeral + totalLideresGeral + totalCabosGeral;

  async function handleExport(format: "csv" | "excel" | "pdf") {
    const exportar = listaComRepresentante;
    if (exportar.length === 0) {
      toast.warning("Nenhuma cidade com representante para exportar.");
      return;
    }
    const filename = "Relatorio_Cidades_Representadas";
    try {
      if (format === "csv") exportCSV(exportar, filename);
      else if (format === "excel") await exportExcel(exportar, filename);
      else exportPDF(exportar, filename);
      toast.success(`Relatório exportado em ${format.toUpperCase()} (${exportar.length} cidades).`);
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
        <PageHeader title="Cidades com Representantes" description="Relatório de cidades com coordenador, líder ou cabo" />
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Acesso restrito a administradores.
          </CardContent>
        </Card>
      </div>
    );
  }

  const statCards = [
    { title: "Total de Cidades", value: totalCidades, icon: Building2, color: "text-primary" },
    { title: "Cidades com Representantes", value: comRepresentantes, icon: UserCheck, color: "text-emerald-500" },
    { title: "Cidades com Coordenador", value: comCoordenador, icon: Users, color: "text-blue-500" },
    { title: "Cidades com Líder", value: comLider, icon: UserCircle, color: "text-amber-500" },
    { title: "Cidades com Cabo", value: comCabo, icon: MapPin, color: "text-purple-500" },
    { title: "Cidades sem Representante", value: semRepresentante, icon: Building2, color: "text-muted-foreground" },
    { title: "Total de Representantes", value: totalRepresentantesGeral, icon: Users, color: "text-primary" },
  ];


  return (
    <div className="space-y-6">
      <PageHeader
        title="Cidades com Representantes"
        description="Quantidade de cidades que possuem coordenador, líder ou cabo eleitoral"
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="busca-filter">Busca rápida</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="busca-filter"
                  className="pl-9"
                  placeholder="Cidade, região ou coordenador..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="coordenador-filter">Coordenador</Label>

              <NativeSelect
                id="coordenador-filter"
                value={coordenadorFiltro}
                onChange={(e) => setCoordenadorFiltro(e.target.value)}
                options={[
                  { value: "todos", label: "Todos" },
                  ...coordenadores.map((c) => ({ value: c.user_id, label: c.nome })),
                ]}
              />
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

            <div className="space-y-2">
              <Label htmlFor="tipo-filter">Tipo de Representante</Label>
              <NativeSelect
                id="tipo-filter"
                value={tipoFiltro}
                onChange={(e) => setTipoFiltro(e.target.value as TipoRepresentante)}
                options={[
                  { value: "todos", label: "Todos" },
                  { value: "coordenador", label: "Com Coordenador" },
                  { value: "lider", label: "Com Líder" },
                  { value: "cabo", label: "Com Cabo" },
                ]}
              />
            </div>

          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {statCards.map((card) => (
              <Card key={card.title}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{card.title}</p>
                      <p className="text-3xl font-bold mt-1">{card.value.toLocaleString("pt-BR")}</p>
                    </div>
                    <card.icon className={`h-8 w-8 ${card.color}`} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Cidades com representante ({listaComRepresentante.length.toLocaleString("pt-BR")})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[520px] overflow-auto">
                <table className="w-full text-sm border-collapse">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-primary text-primary-foreground">
                      <th className="text-left px-3 py-2 font-semibold">Cidade</th>
                      <th className="text-left px-3 py-2 font-semibold">Região</th>
                      <th className="text-center px-3 py-2 font-semibold">Coord.</th>
                      <th className="text-center px-3 py-2 font-semibold">Líderes</th>
                      <th className="text-center px-3 py-2 font-semibold">Cabos</th>
                      <th className="text-center px-3 py-2 font-semibold">Total</th>
                      <th className="text-left px-3 py-2 font-semibold">Coordenadores</th>
                    </tr>
                  </thead>
                  <tbody>
                    {listaComRepresentante.map((c, i) => {
                      const qtdCoord = c.coordenador_nomes?.length || 0;
                      return (
                        <tr
                          key={c.cidade_id}
                          className={i % 2 === 1 ? "bg-primary/10" : "bg-background"}
                        >
                          <td className="px-3 py-2 font-medium">{c.cidade_nome}</td>
                          <td className="px-3 py-2 text-muted-foreground">{c.regiao_administrativa || "-"}</td>
                          <td className="px-3 py-2 text-center">{qtdCoord}</td>
                          <td className="px-3 py-2 text-center">{c.lider_count}</td>
                          <td className="px-3 py-2 text-center">{c.cabo_count}</td>
                          <td className="px-3 py-2 text-center font-semibold">
                            {qtdCoord + c.lider_count + c.cabo_count}
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">
                            {(c.coordenador_nomes || []).join(", ") || "-"}
                          </td>
                        </tr>
                      );
                    })}
                    {listaComRepresentante.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                          Nenhuma cidade com representante nos filtros aplicados.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {listaComRepresentante.length > 0 && (
                    <tfoot className="sticky bottom-0">
                      <tr className="bg-primary text-primary-foreground font-semibold">
                        <td className="px-3 py-2" colSpan={2}>
                          TOTAL ({listaComRepresentante.length} cidades)
                        </td>
                        <td className="px-3 py-2 text-center">{totalCoordenadoresGeral}</td>
                        <td className="px-3 py-2 text-center">{totalLideresGeral}</td>
                        <td className="px-3 py-2 text-center">{totalCabosGeral}</td>
                        <td className="px-3 py-2 text-center">{totalRepresentantesGeral}</td>
                        <td />
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
