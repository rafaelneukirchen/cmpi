import { Fragment, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { GitCompare, Loader2, Search, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { useLiderancas } from "@/hooks/useSupabaseData";
import { useCabosEleitorais } from "@/hooks/useCabosEleitorais";
import { useCidadesOptions } from "@/hooks/useCidadesOptions";
import { useCoordenadores } from "@/hooks/useCoordenadores";
import { normalizeCidade } from "@/hooks/useTseVotosReferencia";
import type { TseCandidato } from "@/hooks/useTseCandidatos";

function useVotos(id: string) {
  return useQuery({
    queryKey: ["tse-votos-comp", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tse_votos_municipio")
        .select("municipio, zona_eleitoral, total_votos")
        .eq("candidato_id", id)
        .range(0, 9999);
      if (error) throw error;
      return data || [];
    },
  });
}

const fmt = (n: number) => n.toLocaleString("pt-BR");
type SituacaoKey = "votos_com_rep" | "sem_voto_com_rep" | "sem_rep_sem_voto" | "sem_rep_com_voto";
const SITUACAO_LABEL: Record<SituacaoKey, string> = {
  votos_com_rep: "Teve votos e tem representante",
  sem_voto_com_rep: "Sem votos, com representante",
  sem_rep_sem_voto: "Sem representante e sem votos",
  sem_rep_com_voto: "Sem representante, mas teve votos",
};

export default function TseComparativoPanel() {
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const { data: zonaBairrosData } = useQuery({
    queryKey: ["tse-zona-bairros"],
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase.from("tse_zona_bairros").select("municipio, zona, bairros").range(0, 4999);
      if (error) throw error;
      return data || [];
    },
  });
  const [idA, setIdA] = useState("");
  const [idB, setIdB] = useState("");
  const [modo, setModo] = useState<"cidade" | "zona">("cidade");
  const [coordFiltro, setCoordFiltro] = useState("");
  const [soComVotos, setSoComVotos] = useState(true);
  const [situacao, setSituacao] = useState<SituacaoKey>("votos_com_rep");

  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim()), 400);
    return () => clearTimeout(t);
  }, [search]);

  const { data: candidatos = [], isLoading } = useQuery({
    queryKey: ["tse-comp-busca", q],
    enabled: q.length >= 3,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tse_candidatos")
        .select("*")
        .ilike("nome_urna", `%${q}%`)
        .order("ano_eleicao", { ascending: false })
        .order("total_votos", { ascending: false })
        .limit(60);
      if (error) throw error;
      return data as TseCandidato[];
    },
  });

  // Group candidates by exact ballot name and detect who has 2+ elections
  const grupos = useMemo(() => {
    const map = new Map<string, TseCandidato[]>();
    for (const c of candidatos) {
      const arr = map.get(c.nome_urna) || [];
      arr.push(c);
      map.set(c.nome_urna, arr);
    }
    return Array.from(map.entries())
      .map(([nome, arr]) => ({
        nome,
        arr: arr.sort((a, b) => b.ano_eleicao - a.ano_eleicao),
        anos: Array.from(new Set(arr.map(c => c.ano_eleicao))).sort((a, b) => b - a),
        votos: arr.reduce((s, c) => s + (c.total_votos || 0), 0),
      }))
      .sort((a, b) => {
        // Prefer candidates with 2+ distinct elections, then by total votes
        const aHas = a.anos.length >= 2 ? 1 : 0;
        const bHas = b.anos.length >= 2 ? 1 : 0;
        if (aHas !== bHas) return bHas - aHas;
        return b.votos - a.votos;
      });
  }, [candidatos]);

  // Auto-select the two most recent elections of the best match (prefer 2+ elections)
  useEffect(() => {
    if (!grupos.length) return;
    const melhor = grupos[0];
    setIdA(melhor.arr[0]?.id || "");
    setIdB(melhor.arr.find(c => c.ano_eleicao !== melhor.arr[0].ano_eleicao)?.id || "");
  }, [grupos]);

  const candA = candidatos.find(c => c.id === idA);
  const candB = candidatos.find(c => c.id === idB);
  const { data: votosA = [], isLoading: lA } = useVotos(idA);
  const { data: votosB = [], isLoading: lB } = useVotos(idB);

  const { data: cidades = [] } = useCidadesOptions();
  const { data: liderancas = [] } = useLiderancas();
  const { data: cabos = [] } = useCabosEleitorais();
  const { data: coordenadores = [] } = useCoordenadores();

  // Map normalized city name -> coordinator names (via leaders & cabos)
  const coordPorCidade = useMemo(() => {
    const cidNome = new Map(cidades.map(c => [c.id, normalizeCidade(c.nome)]));
    const coordNome = new Map(coordenadores.map(c => [c.user_id, c.nome]));
    const result = new Map<string, Map<string, { lideres: number; cabos: number }>>();
    const add = (cidadeIds: (string | null | undefined)[], coordId: string | null | undefined, tipo: "lideres" | "cabos") => {
      if (!coordId) return;
      const nome = coordNome.get(coordId);
      if (!nome) return;
      new Set(cidadeIds.filter(Boolean) as string[]).forEach(cid => {
        const key = cidNome.get(cid);
        if (!key) return;
        const m = result.get(key) || new Map();
        const e = m.get(nome) || { lideres: 0, cabos: 0 };
        e[tipo]++;
        m.set(nome, e);
        result.set(key, m);
      });
    };
    (liderancas as any[]).forEach(l => add([l.cidade_base_id, ...(l.cidades_representadas || [])], l.coordenador_user_id, "lideres"));
    (cabos as any[]).forEach(c => add([c.cidade_base_id, ...(c.cidades_representadas || [])], c.coordenador_user_id, "cabos"));
    return result;
  }, [cidades, coordenadores, liderancas, cabos]);

  // Per city: coordinators with promised votes (votos_por_cidade, fallback votos_estimados on base city)
  const prometidoPorCidade = useMemo(() => {
    const cidNome = new Map(cidades.map(c => [c.id, normalizeCidade(c.nome)]));
    const coordNome = new Map(coordenadores.map(c => [c.user_id, c.nome]));
    const result = new Map<string, Map<string, number>>();
    const add = (p: any) => {
      const nome = p.coordenador_user_id ? coordNome.get(p.coordenador_user_id) : null;
      if (!nome) return;
      const vpc = p.votos_por_cidade || {};
      const entries = Object.entries(vpc);
      if (entries.length) {
        entries.forEach(([cid, v]) => {
          const key = cidNome.get(cid); if (!key) return;
          const m = result.get(key) || new Map();
          m.set(nome, (m.get(nome) || 0) + (Number(v) || 0));
          result.set(key, m);
        });
      } else if (p.cidade_base_id && p.votos_estimados) {
        const key = cidNome.get(p.cidade_base_id); if (!key) return;
        const m = result.get(key) || new Map();
        m.set(nome, (m.get(nome) || 0) + (p.votos_estimados || 0));
        result.set(key, m);
      }
    };
    (liderancas as any[]).forEach(add);
    (cabos as any[]).forEach(add);
    return result;
  }, [cidades, coordenadores, liderancas, cabos]);

  const linhas = useMemo(() => {
    const map = new Map<string, { municipio: string; zona: string; a: number; b: number }>();
    const put = (rows: any[], field: "a" | "b") => rows.forEach(r => {
      const zona = modo === "zona" ? (r.zona_eleitoral || "?") : "";
      const key = normalizeCidade(r.municipio) + "|" + zona;
      const e = map.get(key) || { municipio: r.municipio, zona, a: 0, b: 0 };
      e[field] += r.total_votos || 0;
      map.set(key, e);
    });
    put(votosA, "a");
    put(votosB, "b");
    return Array.from(map.values()).sort((x, y) => (y.a + y.b) - (x.a + x.b));
  }, [votosA, votosB, modo]);

  // Summary of the selected coordinator: leaders, cabos, cities, estimated votes
  const coordInfo = useMemo(() => {
    if (!coordFiltro) return null;
    const coord = coordenadores.find((c: any) => c.user_id === coordFiltro);
    if (!coord) return null;
    const cidNome = new Map(cidades.map(c => [c.id, c.nome]));
    const liders = (liderancas as any[]).filter(l => l.coordenador_user_id === coordFiltro);
    const cbs = (cabos as any[]).filter(c => c.coordenador_user_id === coordFiltro);
    const cidadeIds = new Set<string>();
    liders.forEach(l => [l.cidade_base_id, ...(l.cidades_representadas || [])].forEach((x: string | null) => x && cidadeIds.add(x)));
    cbs.forEach(c => [c.cidade_base_id, ...(c.cidades_representadas || [])].forEach((x: string | null) => x && cidadeIds.add(x)));
    const cidadesNomes = Array.from(cidadeIds).map(id => cidNome.get(id)).filter(Boolean).sort() as string[];
    const votosEstimados =
      liders.reduce((s, l) => s + (l.votos_estimados || 0), 0) +
      cbs.reduce((s, c) => s + (c.votos_estimados || 0), 0);
    const cidadesKeys = new Set(cidadesNomes.map(n => normalizeCidade(n)));
    // Per-city projection (votos_por_cidade) and registered zones (zonas_por_cidade)
    const projPorCidade = new Map<string, number>();
    const zonasPorCidade = new Map<string, Set<number>>();
    [...liders, ...cbs].forEach((p: any) => {
      Object.entries(p.votos_por_cidade || {}).forEach(([cid, v]) => {
        const k = cidNome.get(cid); if (!k) return;
        const key = normalizeCidade(k);
        projPorCidade.set(key, (projPorCidade.get(key) || 0) + (Number(v) || 0));
      });
      Object.entries(p.zonas_por_cidade || {}).forEach(([cid, zs]) => {
        const k = cidNome.get(cid); if (!k || !Array.isArray(zs)) return;
        const key = normalizeCidade(k);
        const set = zonasPorCidade.get(key) || new Set<number>();
        zs.forEach((z: any) => { const n = parseInt(String(z), 10); if (!isNaN(n)) set.add(n); });
        zonasPorCidade.set(key, set);
      });
    });
    return { nome: coord.nome, lideres: liders.length, cabos: cbs.length, cidadesNomes, votosEstimados, cidadesKeys, projPorCidade, zonasPorCidade };
  }, [coordFiltro, coordenadores, liderancas, cabos, cidades]);

  const linhasFiltradas = useMemo(() => {
    return linhas.filter(l => {
      if (soComVotos && l.a + l.b <= 0) return false;
      if (!coordInfo) return true;
      const key = normalizeCidade(l.municipio);
      if (!coordInfo.cidadesKeys.has(key)) return false;
      if (modo === "zona") {
        const zs = coordInfo.zonasPorCidade.get(key);
        if (zs && zs.size) return zs.has(parseInt(l.zona, 10));
      }
      return true;
    });
  }, [linhas, coordInfo, modo, soComVotos]);

  // Count of distinct cities that received votes, per election (in the current filter scope)
  const cidadesComVotos = useMemo(() => {
    const setA = new Set<string>();
    const setB = new Set<string>();
    linhasFiltradas.forEach(l => {
      const k = normalizeCidade(l.municipio);
      if (l.a > 0) setA.add(k);
      if (l.b > 0) setB.add(k);
    });
    return { a: setA.size, b: setB.size };
  }, [linhasFiltradas]);

  // Situação das cidades cadastradas: votos x representante (liderança/cabo)
  const situacaoCidades = useMemo(() => {
    const votos = new Map<string, { a: number; b: number }>();
    const put = (rows: any[], f: "a" | "b") => rows.forEach((r: any) => {
      const k = normalizeCidade(r.municipio);
      const e = votos.get(k) || { a: 0, b: 0 };
      e[f] += r.total_votos || 0; votos.set(k, e);
    });
    put(votosA, "a"); put(votosB, "b");
    const comRep = new Set<string>();
    [...(liderancas as any[]), ...(cabos as any[])].forEach(p =>
      [p.cidade_base_id, ...(p.cidades_representadas || [])].forEach((id: string | null) => id && comRep.add(id)));
    const grupos: Record<SituacaoKey, { nome: string; a: number; b: number; coords: string }[]> = {
      votos_com_rep: [], sem_voto_com_rep: [], sem_rep_sem_voto: [], sem_rep_com_voto: [],
    };
    cidades.forEach((c: any) => {
      const k = normalizeCidade(c.nome);
      const v = votos.get(k) || { a: 0, b: 0 };
      const teveVoto = v.a + v.b > 0;
      const rep = comRep.has(c.id);
      const coords = coordPorCidade.get(k);
      const coordsTxt = coords && coords.size ? Array.from(coords.keys()).join("; ") : "—";
      const key: SituacaoKey = rep ? (teveVoto ? "votos_com_rep" : "sem_voto_com_rep") : (teveVoto ? "sem_rep_com_voto" : "sem_rep_sem_voto");
      grupos[key].push({ nome: c.nome, a: v.a, b: v.b, coords: coordsTxt });
    });
    Object.values(grupos).forEach(g => g.sort((x, y) => (y.a + y.b) - (x.a + x.b) || x.nome.localeCompare(y.nome, "pt-BR")));
    return grupos;
  }, [votosA, votosB, cidades, liderancas, cabos, coordPorCidade]);

  const exportarSituacao = (tipo: "pdf" | "excel") => {
    const lista = situacaoCidades[situacao];
    const anoA = String(candA?.ano_eleicao ?? "A"), anoB = String(candB?.ano_eleicao ?? "B");
    const nome = candA?.nome_urna || candB?.nome_urna || "candidato";
    const titulo = `${SITUACAO_LABEL[situacao]} — ${nome} (${anoA} x ${anoB}) — ${lista.length} cidades`;
    const headers = ["Cidade", anoA, anoB, "Coordenadores"];
    const rows = lista.map(c => [c.nome, fmt(c.a), fmt(c.b), c.coords]);
    const arquivo = `situacao-cidades-${situacao}-${nome}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    if (tipo === "pdf") {
      const doc = new jsPDF();
      doc.setFontSize(12); doc.text(titulo, 14, 18, { maxWidth: 180 });
      autoTable(doc, { startY: 28, head: [headers], body: rows, theme: "grid", headStyles: { fillColor: [30, 45, 80], fontSize: 9 }, bodyStyles: { fontSize: 8 } });
      doc.save(`${arquivo}.pdf`);
    } else {
      const ws = XLSX.utils.aoa_to_sheet([[titulo], [], headers, ...rows]);
      ws["!cols"] = [{ wch: 34 }, { wch: 12 }, { wch: 12 }, { wch: 50 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Situação");
      XLSX.writeFile(wb, `${arquivo}.xlsx`);
    }
  };


  // Zona mode: group by city — city row with totals, then its zones below
  const gruposZona = useMemo(() => {
    const map = new Map<string, { nome: string; a: number; b: number; zonas: { zona: string; a: number; b: number }[] }>();
    linhasFiltradas.forEach(l => {
      const key = normalizeCidade(l.municipio);
      const g = map.get(key) || { nome: l.municipio, a: 0, b: 0, zonas: [] };
      g.a += l.a; g.b += l.b;
      g.zonas.push({ zona: l.zona, a: l.a, b: l.b });
      map.set(key, g);
    });
    return Array.from(map.values()).map(g => ({
      ...g,
      zonas: g.zonas.sort((x, y) => (parseInt(x.zona, 10) || 9999) - (parseInt(y.zona, 10) || 9999) || x.zona.localeCompare(y.zona)),
    })).sort((x, y) => (y.a + y.b) - (x.a + x.b));
  }, [linhasFiltradas]);

  // Coordinator totals: votes in his area (cities + registered zones) vs projection
  const coordTot = useMemo(() => {
    if (!coordInfo) return null;
    const inArea = (r: any) => {
      const key = normalizeCidade(r.municipio);
      if (!coordInfo.cidadesKeys.has(key)) return false;
      const zs = coordInfo.zonasPorCidade.get(key);
      return !zs || !zs.size || zs.has(parseInt(String(r.zona_eleitoral), 10));
    };
    const a = votosA.filter(inArea).reduce((s, r: any) => s + (r.total_votos || 0), 0);
    const b = votosB.filter(inArea).reduce((s, r: any) => s + (r.total_votos || 0), 0);
    const proj = Array.from(coordInfo.projPorCidade.values()).reduce((s, v) => s + v, 0) || coordInfo.votosEstimados;
    const zonas = Array.from(coordInfo.zonasPorCidade.entries()).filter(([, z]) => z.size)
      .map(([k, z]) => `${coordInfo.cidadesNomes.find(n => normalizeCidade(n) === k) || k}: ${Array.from(z).sort((x, y) => x - y).join(", ")}`);
    return { a, b, proj, zonas };
  }, [coordInfo, votosA, votosB]);
  const pct = (v: number, p: number) => p > 0 ? `${Math.round((v / p) * 100)}%` : "—";

  // Report: each city with totals, followed by its zones
  const bairrosZona = useMemo(() => {
    const m = new Map<string, string>();
    (zonaBairrosData || []).forEach((r: any) => m.set(`${normalizeCidade(r.municipio)}|${r.zona}`, r.bairros));
    return m;
  }, [zonaBairrosData]);
  const buildRelatorio = () => {
    const inArea = (r: any) => {
      if (!coordInfo) return true;
      const key = normalizeCidade(r.municipio);
      if (!coordInfo.cidadesKeys.has(key)) return false;
      const zs = coordInfo.zonasPorCidade.get(key);
      return !zs || !zs.size || zs.has(parseInt(String(r.zona_eleitoral), 10));
    };
    const cid = new Map<string, { nome: string; a: number; b: number; zonas: Map<string, { a: number; b: number }> }>();
    const put = (rows: any[], f: "a" | "b") => rows.filter(inArea).forEach(r => {
      const k = normalizeCidade(r.municipio);
      const c = cid.get(k) || { nome: r.municipio, a: 0, b: 0, zonas: new Map() };
      const zk = String(r.zona_eleitoral || "?");
      const z = c.zonas.get(zk) || { a: 0, b: 0 };
      c[f] += r.total_votos || 0; z[f] += r.total_votos || 0;
      c.zonas.set(zk, z); cid.set(k, c);
    });
    put(votosA, "a"); put(votosB, "b");
    const anoA = String(candA?.ano_eleicao ?? "A"), anoB = String(candB?.ano_eleicao ?? "B");
    const headers = ["Cidade / Zona", anoA, anoB, "Diferença", "Prometido", "Coordenadores da cidade", "Bairros da zona"];
    const sd = (n: number) => `${n >= 0 ? "+" : ""}${fmt(n)}`;
    const rows: { cells: string[]; cidade: boolean }[] = [];
    let tA = 0, tB = 0, tP = 0;
    let nCidA = 0, nCidB = 0;
    Array.from(cid.entries()).sort((x, y) => (y[1].a + y[1].b) - (x[1].a + x[1].b)).forEach(([k, c]) => {
      if (soComVotos && c.a + c.b <= 0) return;
      if (c.a > 0) nCidA++;
      if (c.b > 0) nCidB++;
      tA += c.a; tB += c.b;
      const coords = prometidoPorCidade.get(k);
      const prometido = coords ? Array.from(coords.values()).reduce((s, v) => s + v, 0) : 0;
      tP += prometido;
      const coordsTxt = coords && coords.size
        ? Array.from(coords.entries()).sort((x, y) => y[1] - x[1]).map(([n, v]) => `${n} (${fmt(v)})`).join("; ")
        : "—";
      rows.push({ cidade: true, cells: [c.nome, fmt(c.a), fmt(c.b), sd(c.a - c.b), prometido ? fmt(prometido) : "—", coordsTxt] });
      Array.from(c.zonas.entries()).sort((x, y) => parseInt(x[0]) - parseInt(y[0])).forEach(([z, v]) => {
        const bairros = bairrosZona.get(`${k}|${parseInt(z, 10)}`) || "—";
        rows.push({ cidade: false, cells: [`    Zona ${z}`, fmt(v.a), fmt(v.b), sd(v.a - v.b), "", "", bairros] });
      });
    });
    rows.push({ cidade: true, cells: ["TOTAL", fmt(tA), fmt(tB), sd(tA - tB), fmt(tP), "", ""] });
    const nome = candA?.nome_urna || candB?.nome_urna || "candidato";
    const titulo = `Comparativo TSE ${anoA} x ${anoB} — ${nome}${coordInfo ? ` — Coordenador ${coordInfo.nome}` : ""}`;
    const resumo = `Cidades com votos: ${anoA} = ${nCidA} • ${anoB} = ${nCidB}${soComVotos ? " (somente cidades com votos)" : ""}`;
    const arquivo = `comparativo-tse-${nome}-${anoA}x${anoB}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    return { headers, rows, titulo, resumo, arquivo };
  };

  const exportarPdf = () => {
    const { headers, rows, titulo, resumo, arquivo } = buildRelatorio();
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(13); doc.text(titulo, 14, 18, { maxWidth: 265 });
    doc.setFontSize(9); doc.setTextColor(100);
    doc.text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")} • ${resumo}`, 14, 28);
    autoTable(doc, {
      startY: 32, head: [headers], body: rows.map(r => r.cells), theme: "grid",
      headStyles: { fillColor: [30, 45, 80], fontSize: 9 }, bodyStyles: { fontSize: 8 },
      columnStyles: Object.fromEntries(headers.map((_, i) => [i, i === 6 ? { halign: "left", cellWidth: 85 } : { halign: i === 0 ? "left" : "right" }])) as any,
      didParseCell: (d: any) => {
        if (d.section === "body" && rows[d.row.index]?.cidade) { d.cell.styles.fontStyle = "bold"; d.cell.styles.fillColor = [226, 232, 240]; }
      },
      margin: { left: 14, right: 14 },
    });
    doc.save(`${arquivo}.pdf`);
  };

  const exportarExcel = () => {
    const { headers, rows, titulo, resumo, arquivo } = buildRelatorio();
    const ws = XLSX.utils.aoa_to_sheet([[titulo], [resumo], [], headers, ...rows.map(r => r.cells)]);
    ws["!cols"] = headers.map((_, i) => ({ wch: i === 0 ? 34 : i === 6 ? 80 : 14 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Comparativo");
    XLSX.writeFile(wb, `${arquivo}.xlsx`);
  };

  const totA = votosA.reduce((s, r: any) => s + (r.total_votos || 0), 0);
  const totB = votosB.reduce((s, r: any) => s + (r.total_votos || 0), 0);
  const opts = candidatos.map(c => ({
    value: c.id,
    label: `${c.ano_eleicao} • ${c.nome_urna} (${c.numero_candidato}) • ${c.cargo}${c.municipio ? ` - ${c.municipio}` : ""}`,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <GitCompare className="h-5 w-5 text-primary" /> Comparativo TSE entre eleições
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Compare votos por cidade e zona eleitoral entre duas eleições (ex.: 2026 x 2022) e veja de qual coordenador são esses votos.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Digite o nome do candidato (mín. 3 letras)..." value={search} onChange={e => setSearch(e.target.value)} />
          {isLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin" />}
        </div>

        {candidatos.length > 0 && grupos.length > 0 && (
          <>
            {/* Lista de candidatos encontrados com indicação das eleições */}
            <div className="rounded-md border">
              <div className="border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
                {grupos.length} {grupos.length === 1 ? "candidato encontrado" : "candidatos encontrados"} — clique para comparar
              </div>
              <div className="max-h-64 overflow-y-auto divide-y">
                {grupos.map((g, idx) => {
                  const isSelected = g.arr.some(c => c.id === idA || c.id === idB);
                  const tem2 = g.anos.length >= 2;
                  return (
                    <button
                      key={g.nome}
                      type="button"
                      onClick={() => {
                        setIdA(g.arr[0]?.id || "");
                        setIdB(g.arr.find(c => c.ano_eleicao !== g.arr[0].ano_eleicao)?.id || "");
                      }}
                      className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-accent ${isSelected ? "bg-primary/10" : ""} ${idx === 0 ? "" : ""}`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{g.nome}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {g.arr[0]?.cargo}{g.arr[0]?.sigla_partido ? ` • ${g.arr[0].sigla_partido}` : ""}{g.arr[0]?.municipio ? ` • ${g.arr[0].municipio}` : ""}
                        </p>
                      </div>
                      <div className="flex flex-shrink-0 items-center gap-1">
                        {g.anos.map(a => (
                          <span key={a} className="rounded bg-secondary px-1.5 py-0.5 text-xs font-medium">{a}</span>
                        ))}
                        {tem2 ? (
                          <span className="rounded bg-primary/15 px-1.5 py-0.5 text-xs font-semibold text-primary">2+ eleições</span>
                        ) : (
                          <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">1 eleição</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Destaque do candidato selecionado */}
            {(() => {
              const sel = grupos.find(g => g.arr.some(c => c.id === idA));
              if (!sel) return null;
              return sel.anos.length >= 2 ? (
                <div className="rounded-md border bg-primary/10 border-primary/30 p-2.5 text-sm">
                  <span className="font-semibold text-primary">{sel.nome}</span>
                  <span className="text-muted-foreground"> tem {sel.anos.length} eleições: </span>
                  <span className="font-medium">{sel.anos.join(" • ")}</span>
                  <span className="text-muted-foreground"> — comparando {sel.anos[0]} e {sel.anos[1]} automaticamente.</span>
                </div>
              ) : (
                <div className="rounded-md border bg-muted/40 p-2.5 text-sm text-muted-foreground">
                  <span className="font-semibold">{sel.nome}</span> tem apenas 1 eleição ({sel.anos[0]}). Selecione outra eleição manualmente para comparar.
                </div>
              );
            })()}
          </>
        )}

        {candidatos.length > 0 && (
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Eleição A</label>
              <NativeSelect value={idA} onChange={e => setIdA(e.target.value)} options={opts} placeholder="Selecione..." />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Eleição B</label>
              <NativeSelect value={idB} onChange={e => setIdB(e.target.value)} options={opts} placeholder="Selecione..." />
            </div>
          </div>
        )}

        {q.length >= 3 && !isLoading && candidatos.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum candidato encontrado.</p>
        )}

        {(candA || candB) && (
          <>
            <div className="grid gap-3 sm:grid-cols-4">
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">{candA ? `${candA.ano_eleicao} • ${candA.cargo}` : "Eleição A"}</p>
                <p className="text-xl font-bold">{fmt(totA)}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">{candB ? `${candB.ano_eleicao} • ${candB.cargo}` : "Eleição B"}</p>
                <p className="text-xl font-bold">{fmt(totB)}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Diferença (A − B)</p>
                <p className={`text-xl font-bold ${totA - totB >= 0 ? "text-primary" : "text-destructive"}`}>
                  {totA - totB >= 0 ? "+" : ""}{fmt(totA - totB)}
                </p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Cidades com votos</p>
                <p className="text-xl font-bold">{fmt(cidadesComVotos.a)} <span className="text-sm font-normal text-muted-foreground">em {candA?.ano_eleicao ?? "A"}</span></p>
                <p className="text-xl font-bold">{fmt(cidadesComVotos.b)} <span className="text-sm font-normal text-muted-foreground">em {candB?.ano_eleicao ?? "B"}</span></p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {(["cidade", "zona"] as const).map(m => (
                <button key={m} type="button" onClick={() => setModo(m)}
                  className={`rounded-md border px-3 py-1.5 text-sm font-medium ${modo === m ? "border-primary bg-primary/10 text-primary" : "border-input hover:bg-accent"}`}>
                  {m === "cidade" ? "Por cidade" : "Por zona eleitoral"}
                </button>
              ))}
              <button type="button" onClick={() => setSoComVotos(v => !v)}
                className={`rounded-md border px-3 py-1.5 text-sm font-medium ${soComVotos ? "border-primary bg-primary/10 text-primary" : "border-input hover:bg-accent"}`}>
                Somente cidades com votos
              </button>
              <div className="min-w-[220px] flex-1 sm:max-w-sm">
                <NativeSelect
                  value={coordFiltro}
                  onChange={e => setCoordFiltro(e.target.value)}
                  options={[
                    { value: "", label: "Todos os coordenadores (todas as zonas)" },
                    ...coordenadores.map((c: any) => ({ value: c.user_id, label: c.nome })),
                  ]}
                />
              </div>
              <Button variant="outline" size="sm" onClick={exportarPdf} disabled={lA || lB}>
                <FileDown className="h-4 w-4 mr-1" /> PDF
              </Button>
              <Button variant="outline" size="sm" onClick={exportarExcel} disabled={lA || lB}>
                <FileDown className="h-4 w-4 mr-1" /> Excel
              </Button>
            </div>
            <div className="space-y-2 rounded-md border p-3">
              <p className="text-sm font-semibold">Situação das {fmt(cidades.length)} cidades (votos x representante)</p>
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                {(Object.keys(SITUACAO_LABEL) as SituacaoKey[]).map(k => (
                  <button key={k} type="button" onClick={() => setSituacao(k)}
                    className={`rounded-md border p-2 text-left ${situacao === k ? "border-primary bg-primary/10" : "border-input hover:bg-accent"}`}>
                    <p className="text-xs text-muted-foreground">{SITUACAO_LABEL[k]}</p>
                    <p className="text-lg font-bold">{fmt(situacaoCidades[k].length)}</p>
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => exportarSituacao("pdf")} disabled={lA || lB}>
                  <FileDown className="h-4 w-4 mr-1" /> PDF desta lista
                </Button>
                <Button variant="outline" size="sm" onClick={() => exportarSituacao("excel")} disabled={lA || lB}>
                  <FileDown className="h-4 w-4 mr-1" /> Excel desta lista
                </Button>
              </div>
              <div className="max-h-[300px] overflow-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cidade</TableHead>
                      <TableHead className="text-right">{candA?.ano_eleicao ?? "A"}</TableHead>
                      <TableHead className="text-right">{candB?.ano_eleicao ?? "B"}</TableHead>
                      <TableHead>Coordenadores</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {situacaoCidades[situacao].map(c => (
                      <TableRow key={c.nome}>
                        <TableCell className="font-medium">{c.nome}</TableCell>
                        <TableCell className="text-right">{fmt(c.a)}</TableCell>
                        <TableCell className="text-right">{fmt(c.b)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{c.coords}</TableCell>
                      </TableRow>
                    ))}
                    {situacaoCidades[situacao].length === 0 && (
                      <TableRow><TableCell colSpan={4} className="py-4 text-center text-muted-foreground">Nenhuma cidade nesta situação</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>


            {coordInfo && (
              <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-1">
                <p className="font-semibold">{coordInfo.nome}</p>
                <p className="text-muted-foreground">
                  {coordInfo.lideres} {coordInfo.lideres === 1 ? "liderança" : "lideranças"} • {coordInfo.cabos} {coordInfo.cabos === 1 ? "cabo eleitoral" : "cabos eleitorais"} • {coordInfo.cidadesNomes.length} {coordInfo.cidadesNomes.length === 1 ? "cidade" : "cidades"} • {fmt(coordInfo.votosEstimados)} votos estimados
                </p>
                {coordInfo.cidadesNomes.length > 0 && (
                  <p className="text-xs text-muted-foreground">Cidades: {coordInfo.cidadesNomes.join(", ")}</p>
                )}
                {coordTot && coordTot.zonas.length > 0 && (
                  <p className="text-xs text-muted-foreground">Zonas eleitorais cadastradas pela equipe: {coordTot.zonas.join(" • ")}</p>
                )}
                {coordTot && (
                  <div className="grid gap-2 pt-2 sm:grid-cols-4">
                    <div className="rounded-md border bg-background p-2">
                      <p className="text-xs text-muted-foreground">Projeção (expectativa da equipe)</p>
                      <p className="text-lg font-bold">{fmt(coordTot.proj)}</p>
                    </div>
                    <div className="rounded-md border bg-background p-2">
                      <p className="text-xs text-muted-foreground">Realidade {candA?.ano_eleicao ?? "A"} (TSE)</p>
                      <p className="text-lg font-bold">{fmt(coordTot.a)}</p>
                      <p className="text-xs text-muted-foreground">{pct(coordTot.a, coordTot.proj)} da projeção</p>
                    </div>
                    <div className="rounded-md border bg-background p-2">
                      <p className="text-xs text-muted-foreground">Eleição anterior {candB?.ano_eleicao ?? "B"} (TSE)</p>
                      <p className="text-lg font-bold">{fmt(coordTot.b)}</p>
                      <p className="text-xs text-muted-foreground">{pct(coordTot.b, coordTot.proj)} da projeção</p>
                    </div>
                    <div className="rounded-md border bg-background p-2">
                      <p className="text-xs text-muted-foreground">Diferença entre eleições</p>
                      <p className={`text-lg font-bold ${coordTot.a - coordTot.b >= 0 ? "text-primary" : "text-destructive"}`}>{coordTot.a - coordTot.b >= 0 ? "+" : ""}{fmt(coordTot.a - coordTot.b)}</p>
                    </div>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">A tabela abaixo mostra apenas as cidades deste coordenador{modo === "zona" ? " e, quando cadastradas, somente as zonas da equipe dele" : ""}. Quando o TSE divulgar a nova eleição, a "Realidade" será atualizada automaticamente.</p>
              </div>
            )}

            {(lA || lB) ? (
              <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : (
              <div className="max-h-[520px] overflow-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cidade</TableHead>
                      {modo === "zona" && <TableHead>Zona</TableHead>}
                      <TableHead className="text-right">{candA?.ano_eleicao ?? "A"}</TableHead>
                      <TableHead className="text-right">{candB?.ano_eleicao ?? "B"}</TableHead>
                      <TableHead className="text-right">Diferença</TableHead>
                      {coordInfo && modo === "cidade" && <TableHead className="text-right">Projeção</TableHead>}
                      {coordInfo && modo === "cidade" && <TableHead className="text-right">Alcançado</TableHead>}
                      <TableHead>Coordenador responsável na cidade</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {modo === "zona" ? gruposZona.map(g => {
                      const coords = coordPorCidade.get(normalizeCidade(g.nome));
                      const diffG = g.a - g.b;
                      return (
                        <Fragment key={g.nome}>
                          <TableRow className="bg-muted/60">
                            <TableCell className="font-bold">{g.nome}</TableCell>
                            <TableCell className="text-xs font-bold uppercase text-muted-foreground">Total</TableCell>
                            <TableCell className="text-right font-bold">{fmt(g.a)}</TableCell>
                            <TableCell className="text-right font-bold">{fmt(g.b)}</TableCell>
                            <TableCell className={`text-right font-bold ${diffG >= 0 ? "text-primary" : "text-destructive"}`}>
                              {diffG >= 0 ? "+" : ""}{fmt(diffG)}
                            </TableCell>
                            <TableCell>
                              {coords && coords.size ? (
                                <div className="flex flex-wrap gap-1">
                                  {Array.from(coords.entries()).map(([nome, c]) => (
                                    <div key={nome} className="rounded-md bg-muted px-2 py-1 text-xs">
                                      <span className="font-semibold">{nome}</span>
                                      <span className="text-muted-foreground">
                                        {" — "}
                                        {[
                                          c.lideres ? `${c.lideres} ${c.lideres === 1 ? "liderança" : "lideranças"}` : null,
                                          c.cabos ? `${c.cabos} ${c.cabos === 1 ? "cabo eleitoral" : "cabos eleitorais"}` : null,
                                        ].filter(Boolean).join(" e ")} na cidade
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              ) : <span className="text-xs text-muted-foreground">Nenhum coordenador cadastrado nesta cidade</span>}
                            </TableCell>
                          </TableRow>
                          {g.zonas.map(z => {
                            const diff = z.a - z.b;
                            return (
                              <TableRow key={`${g.nome}-${z.zona}`}>
                                <TableCell />
                                <TableCell><span className="rounded bg-secondary px-1.5 py-0.5 text-xs font-medium">Zona {z.zona}</span></TableCell>
                                <TableCell className="text-right">{fmt(z.a)}</TableCell>
                                <TableCell className="text-right">{fmt(z.b)}</TableCell>
                                <TableCell className={`text-right font-medium ${diff >= 0 ? "text-primary" : "text-destructive"}`}>
                                  {diff >= 0 ? "+" : ""}{fmt(diff)}
                                </TableCell>
                                <TableCell />
                              </TableRow>
                            );
                          })}
                        </Fragment>
                      );
                    }) : linhasFiltradas.map(l => {
                      const diff = l.a - l.b;
                      const coords = coordPorCidade.get(normalizeCidade(l.municipio));
                      return (
                        <TableRow key={l.municipio}>
                          <TableCell className="font-medium">{l.municipio}</TableCell>
                          <TableCell className="text-right">{fmt(l.a)}</TableCell>
                          <TableCell className="text-right">{fmt(l.b)}</TableCell>
                          <TableCell className={`text-right font-medium ${diff >= 0 ? "text-primary" : "text-destructive"}`}>
                            {diff >= 0 ? "+" : ""}{fmt(diff)}
                          </TableCell>
                          {coordInfo && modo === "cidade" && (() => {
                            const pj = coordInfo.projPorCidade.get(normalizeCidade(l.municipio)) || 0;
                            return (<>
                              <TableCell className="text-right">{pj ? fmt(pj) : "—"}</TableCell>
                              <TableCell className="text-right">{pct(l.a, pj)}</TableCell>
                            </>);
                          })()}
                          <TableCell>
                            {coords && coords.size ? (
                              <div className="flex flex-wrap gap-1">
                                {Array.from(coords.entries()).map(([nome, c]) => (
                                  <div key={nome} className="rounded-md bg-muted px-2 py-1 text-xs">
                                    <span className="font-semibold">{nome}</span>
                                    <span className="text-muted-foreground">
                                      {" — "}
                                      {[
                                        c.lideres ? `${c.lideres} ${c.lideres === 1 ? "liderança" : "lideranças"}` : null,
                                        c.cabos ? `${c.cabos} ${c.cabos === 1 ? "cabo eleitoral" : "cabos eleitorais"}` : null,
                                      ].filter(Boolean).join(" e ")} na cidade
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : <span className="text-xs text-muted-foreground">Nenhum coordenador cadastrado nesta cidade</span>}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
