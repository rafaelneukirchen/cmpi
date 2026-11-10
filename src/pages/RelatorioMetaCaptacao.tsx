import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/logistics/PageHeader";
import { Download, Target, Loader2, Search } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { exportStyledExcel } from "@/lib/exportExcelStyled";

type Nivel = "individual" | "lideranca" | "coordenador";

interface MetaRow {
  id: string;
  nome: string;
  tipo: string;
  vinculo: string;
  meta: number;
  captados: number;
}

const HEADERS = ["Nome", "Tipo", "Vínculo", "Meta (estimativa)", "Captados", "Falta", "% da meta"];

function toRow(r: MetaRow): (string | number)[] {
  const falta = Math.max(0, r.meta - r.captados);
  const pct = r.meta > 0 ? Math.round((r.captados / r.meta) * 100) : 0;
  return [r.nome, r.tipo, r.vinculo, r.meta, r.captados, falta, `${pct}%`];
}

function totals(rows: MetaRow[]) {
  const meta = rows.reduce((s, r) => s + r.meta, 0);
  const cap = rows.reduce((s, r) => s + r.captados, 0);
  return { meta, cap, falta: Math.max(0, meta - cap), pct: meta > 0 ? Math.round((cap / meta) * 100) : 0 };
}

async function exportExcel(rows: MetaRow[], nivel: Nivel) {
  const t = totals(rows);
  const data = rows.map(toRow);
  data.push([`TOTAL (${rows.length})`, "", "", t.meta, t.cap, t.falta, `${t.pct}%`]);
  await exportStyledExcel(
    `meta-captacao-${nivel}-${new Date().toISOString().slice(0, 10)}`,
    "Meta de Captação",
    [
      { header: HEADERS[0], width: 38 },
      { header: HEADERS[1], width: 16 },
      { header: HEADERS[2], width: 34 },
      { header: HEADERS[3], width: 18 },
      { header: HEADERS[4], width: 14 },
      { header: HEADERS[5], width: 14 },
      { header: HEADERS[6], width: 14 },
    ],
    data,
    `Relatório de Meta de Captação (${nivel}) — ${new Date().toLocaleDateString("pt-BR")}`,
  );
}

function exportPDF(rows: MetaRow[], nivel: Nivel) {
  const t = totals(rows);
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(16);
  doc.text(`Relatório de Meta de Captação — ${nivel}`, 14, 20);
  doc.setFontSize(10);
  doc.text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")}`, 14, 28);
  doc.text(`Meta total: ${t.meta}  |  Captados: ${t.cap}  |  Falta: ${t.falta}  |  ${t.pct}% da meta`, 14, 34);
  autoTable(doc, {
    head: [HEADERS],
    body: rows.map((r) => toRow(r).map(String)),
    foot: [[`TOTAL (${rows.length})`, "", "", String(t.meta), String(t.cap), String(t.falta), `${t.pct}%`]],
    startY: 40,
    styles: { fontSize: 8, cellPadding: 2, lineColor: [180, 194, 218], lineWidth: 0.1 },
    headStyles: { fillColor: [30, 45, 80], textColor: 255, fontStyle: "bold" },
    footStyles: { fillColor: [30, 45, 80], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [220, 230, 245] },
  });
  doc.save(`meta-captacao-${nivel}-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export default function RelatorioMetaCaptacao() {
  const { session, loading: authLoading } = useAuth();
  const [nivel, setNivel] = useState<Nivel>("individual");
  const [busca, setBusca] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["relatorio-meta-captacao", session?.user?.id],
    enabled: !authLoading && !!session,
    queryFn: async () => {
      const [lidRes, caboRes, profRes, hierRes, rankCaboRes] = await Promise.all([
        supabase.from("liderancas").select("id, nome, votos_estimados, coordenador_user_id"),
        supabase.from("cabos_eleitorais").select("id, nome, votos_estimados, lider_id, coordenador_user_id"),
        supabase.from("profiles").select("user_id, nome"),
        supabase.rpc("get_captados_hierarchy"),
        supabase.rpc("get_captados_ranking_cabos"),
      ]);
      if (lidRes.error) throw lidRes.error;
      if (caboRes.error) throw caboRes.error;
      return {
        liderancas: (lidRes.data ?? []) as { id: string; nome: string; votos_estimados: number | null; coordenador_user_id: string | null }[],
        cabos: (caboRes.data ?? []) as { id: string; nome: string; votos_estimados: number | null; lider_id: string; coordenador_user_id: string | null }[],
        profiles: (profRes.data ?? []) as { user_id: string; nome: string }[],
        hierarchy: (hierRes.data ?? []) as { captado_id: string; lider_id: string | null; coord_id: string | null }[],
        rankCabos: (rankCaboRes.data ?? []) as { cabo_id: string; nome: string; total: number }[],
      };
    },
  });

  const rows = useMemo<MetaRow[]>(() => {
    if (!data) return [];
    const { liderancas, cabos, profiles, hierarchy, rankCabos } = data;
    const nomeCoord = new Map(profiles.map((p) => [p.user_id, p.nome]));
    const lidById = new Map(liderancas.map((l) => [l.id, l]));

    const capByLider = new Map<string, number>();
    const capByCoord = new Map<string, number>();
    for (const h of hierarchy) {
      if (h.lider_id) capByLider.set(h.lider_id, (capByLider.get(h.lider_id) ?? 0) + 1);
      if (h.coord_id) capByCoord.set(h.coord_id, (capByCoord.get(h.coord_id) ?? 0) + 1);
    }
    const capByCabo = new Map(rankCabos.map((c) => [c.cabo_id, Number(c.total) || 0]));

    const cabosByLider = new Map<string, typeof cabos>();
    for (const c of cabos) {
      const arr = cabosByLider.get(c.lider_id) ?? [];
      arr.push(c);
      cabosByLider.set(c.lider_id, arr);
    }

    const coordDoCabo = (c: (typeof cabos)[number]) =>
      c.coordenador_user_id || lidById.get(c.lider_id)?.coordenador_user_id || null;

    if (nivel === "individual") {
      const lidRows: MetaRow[] = liderancas.map((l) => {
        const cabosDele = cabosByLider.get(l.id) ?? [];
        const capCabos = cabosDele.reduce((s, c) => s + (capByCabo.get(c.id) ?? 0), 0);
        return {
          id: l.id,
          nome: l.nome,
          tipo: "Liderança",
          vinculo: l.coordenador_user_id ? nomeCoord.get(l.coordenador_user_id) ?? "-" : "-",
          meta: l.votos_estimados ?? 0,
          captados: Math.max(0, (capByLider.get(l.id) ?? 0) - capCabos),
        };
      });
      const caboRows: MetaRow[] = cabos.map((c) => ({
        id: c.id,
        nome: c.nome,
        tipo: "Cabo eleitoral",
        vinculo: lidById.get(c.lider_id)?.nome ?? "-",
        meta: c.votos_estimados ?? 0,
        captados: capByCabo.get(c.id) ?? 0,
      }));
      return [...lidRows, ...caboRows].sort((a, b) => b.meta - a.meta);
    }

    if (nivel === "lideranca") {
      return liderancas
        .map((l) => {
          const cabosDele = cabosByLider.get(l.id) ?? [];
          return {
            id: l.id,
            nome: l.nome,
            tipo: `Liderança + ${cabosDele.length} cabo(s)`,
            vinculo: l.coordenador_user_id ? nomeCoord.get(l.coordenador_user_id) ?? "-" : "-",
            meta: (l.votos_estimados ?? 0) + cabosDele.reduce((s, c) => s + (c.votos_estimados ?? 0), 0),
            captados: capByLider.get(l.id) ?? 0,
          };
        })
        .sort((a, b) => b.meta - a.meta);
    }

    const metaCoord = new Map<string, { meta: number; lids: number; cabos: number }>();
    for (const l of liderancas) {
      if (!l.coordenador_user_id) continue;
      const cur = metaCoord.get(l.coordenador_user_id) ?? { meta: 0, lids: 0, cabos: 0 };
      cur.meta += l.votos_estimados ?? 0;
      cur.lids += 1;
      metaCoord.set(l.coordenador_user_id, cur);
    }
    for (const c of cabos) {
      const coord = coordDoCabo(c);
      if (!coord) continue;
      const cur = metaCoord.get(coord) ?? { meta: 0, lids: 0, cabos: 0 };
      cur.meta += c.votos_estimados ?? 0;
      cur.cabos += 1;
      metaCoord.set(coord, cur);
    }
    return Array.from(metaCoord.entries())
      .map(([userId, v]) => ({
        id: userId,
        nome: nomeCoord.get(userId) ?? "Sem coordenador",
        tipo: "Coordenação",
        vinculo: `${v.lids} liderança(s) · ${v.cabos} cabo(s)`,
        meta: v.meta,
        captados: capByCoord.get(userId) ?? 0,
      }))
      .sort((a, b) => b.meta - a.meta);
  }, [data, nivel]);

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (!termo) return rows;
    return rows.filter((r) =>
      `${r.nome} ${r.vinculo}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(termo),
    );
  }, [rows, busca]);

  const t = totals(filtradas);

  return (
    <div className="space-y-6 max-w-7xl">
      <PageHeader title="Meta de Captação" description="Somatória das estimativas de lideranças e cabos vs. apoiadores captados">
        <div className="flex gap-2">
          <Button className="gap-2" onClick={() => exportPDF(filtradas, nivel)} disabled={!filtradas.length}>
            <Download className="w-4 h-4" /> PDF
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => exportExcel(filtradas, nivel)} disabled={!filtradas.length}>
            <Download className="w-4 h-4" /> Excel
          </Button>
        </div>
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Meta total", value: t.meta },
          { label: "Captados", value: t.cap },
          { label: "Falta captar", value: t.falta },
          { label: "% da meta", value: `${t.pct}%` },
        ].map((c) => (
          <Card key={c.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{typeof c.value === "number" ? c.value.toLocaleString("pt-BR") : c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="pt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Nível do relatório</Label>
            <NativeSelect
              value={nivel}
              onChange={(e) => setNivel(e.target.value as Nivel)}
              options={[
                { value: "individual", label: "Individual (liderança e cabo)" },
                { value: "lideranca", label: "Por liderança (com equipe)" },
                { value: "coordenador", label: "Por coordenador" },
              ]}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Buscar</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="Nome ou vínculo..." value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="w-4 h-4 text-primary" /> {filtradas.length} registro(s)
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
                    <th className="py-2 pr-3">Nome</th>
                    <th className="py-2 pr-3">Tipo</th>
                    <th className="py-2 pr-3">Vínculo</th>
                    <th className="py-2 pr-3 text-right">Meta</th>
                    <th className="py-2 pr-3 text-right">Captados</th>
                    <th className="py-2 pr-3 text-right">Falta</th>
                    <th className="py-2 w-36">Progresso</th>
                  </tr>
                </thead>
                <tbody>
                  {filtradas.map((r) => {
                    const pct = r.meta > 0 ? Math.min(100, Math.round((r.captados / r.meta) * 100)) : 0;
                    return (
                      <tr key={`${r.tipo}-${r.id}`} className="border-b last:border-0">
                        <td className="py-2 pr-3 font-medium">{r.nome}</td>
                        <td className="py-2 pr-3 text-muted-foreground">{r.tipo}</td>
                        <td className="py-2 pr-3 text-muted-foreground">{r.vinculo}</td>
                        <td className="py-2 pr-3 text-right">{r.meta.toLocaleString("pt-BR")}</td>
                        <td className="py-2 pr-3 text-right">{r.captados.toLocaleString("pt-BR")}</td>
                        <td className="py-2 pr-3 text-right">{Math.max(0, r.meta - r.captados).toLocaleString("pt-BR")}</td>
                        <td className="py-2">
                          <div className="flex items-center gap-2">
                            <Progress value={pct} className="h-2" />
                            <span className="text-xs text-muted-foreground w-10 text-right">{pct}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {!filtradas.length && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-muted-foreground">Nenhum registro encontrado</td>
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
