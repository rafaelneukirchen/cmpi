import { useState, useMemo, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Loader2, MapPin, TrendingUp, Award, X, UserPlus, FileDown } from "lucide-react";
import { useTseBusca, useTseVotos, useTseAnosDisponiveis, type TseCandidato } from "@/hooks/useTseCandidatos";
import { exportTablePdf, exportTableExcel } from "@/lib/exportPdf";
import { toast } from "sonner";
import L from "leaflet";

interface Props {
  onUsarDobradinha?: (nome: string, votos: number) => void;
}

export default function TsePesquisaPanel({ onUsarDobradinha }: Props) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selected, setSelected] = useState<TseCandidato | null>(null);
  const [anoFiltro, setAnoFiltro] = useState<number | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const heatRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const { data: anosDisp = [] } = useTseAnosDisponiveis();
  const { data: resultados = [], isLoading } = useTseBusca(debouncedSearch, anoFiltro);
  const { data: votos = [], isLoading: loadingVotos } = useTseVotos(selected?.id || null);

  // Keep raw votos per zone for map + table
  const votosPorZona = useMemo(() => {
    return votos
      .map(v => ({
        municipio: v.municipio,
        zona: v.zona_eleitoral || "?",
        total: v.total_votos,
      }))
      .sort((a, b) => b.total - a.total);
  }, [votos]);

  // Aggregated by municipio (for stats cards)
  const votosPorMunicipio = useMemo(() => {
    const map = new Map<string, { municipio: string; total: number; zonas: string[] }>();
    votos.forEach(v => {
      const key = v.municipio;
      const curr = map.get(key) || { municipio: v.municipio, total: 0, zonas: [] };
      curr.total += v.total_votos;
      if (v.zona_eleitoral) curr.zonas.push(v.zona_eleitoral);
      map.set(key, curr);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [votos]);

  const maiorVotacao = votosPorMunicipio[0];

  // Grouped: city (total) followed by its zones, ordered by zone number
  const gruposCidade = useMemo(() => {
    const map = new Map<string, { municipio: string; total: number; zonas: { zona: string; total: number }[] }>();
    votos.forEach(v => {
      const g = map.get(v.municipio) || { municipio: v.municipio, total: 0, zonas: [] };
      g.total += v.total_votos;
      const zk = v.zona_eleitoral || "?";
      const z = g.zonas.find(x => x.zona === zk);
      if (z) z.total += v.total_votos; else g.zonas.push({ zona: zk, total: v.total_votos });
      map.set(v.municipio, g);
    });
    return Array.from(map.values())
      .map(g => ({ ...g, zonas: g.zonas.sort((a, b) => (parseInt(a.zona, 10) || 9999) - (parseInt(b.zona, 10) || 9999)) }))
      .sort((a, b) => b.total - a.total);
  }, [votos]);

  const linhasRelatorio = (numFmt: (n: number) => string) => {
    const tot = selected?.total_votos || 1;
    const pctS = (n: number) => `${((n / tot) * 100).toFixed(1)}%`;
    const rows: string[][] = [];
    gruposCidade.forEach(g => {
      rows.push([`${g.municipio} — TOTAL`, "", numFmt(g.total), pctS(g.total)]);
      g.zonas.forEach(z => rows.push(["", `Zona ${z.zona}`, numFmt(z.total), pctS(z.total)]));
    });
    return rows;
  };

  // Init map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    const map = L.map(mapContainerRef.current, {
      center: [-22.5, -48.5],
      zoom: 7,
      zoomControl: true,
      attributionControl: false,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
    }).addTo(map);
    mapRef.current = map;
    markersRef.current = L.layerGroup().addTo(map);
    heatRef.current = L.layerGroup().addTo(map);
    return () => { map.remove(); mapRef.current = null; };
  }, [selected]);

  // Geocode and render zone-level markers
  useEffect(() => {
    if (!mapRef.current || !markersRef.current || !heatRef.current) return;
    markersRef.current.clearLayers();
    heatRef.current.clearLayers();

    if (votosPorZona.length === 0) return;

    const maxVotos = votosPorZona[0]?.total || 1;

    // Group zones by municipio for geocoding
    const zonesByMunicipio = new Map<string, typeof votosPorZona>();
    votosPorZona.forEach(z => {
      const arr = zonesByMunicipio.get(z.municipio) || [];
      arr.push(z);
      zonesByMunicipio.set(z.municipio, arr);
    });

    const geocodeAndPlot = async () => {
      const bounds: L.LatLngBounds = L.latLngBounds([]);
      const municipios = Array.from(zonesByMunicipio.entries()).slice(0, 20);

      for (const [municipio, zones] of municipios) {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(municipio + ", São Paulo, Brasil")}&format=json&limit=1`
          );
          const data = await res.json();
          if (!data[0]) continue;

          const baseLat = parseFloat(data[0].lat);
          const baseLng = parseFloat(data[0].lon);

          // Spread zones in a spiral around the center
          zones.forEach((z, i) => {
            const angle = (i * 137.5 * Math.PI) / 180; // golden angle
            const dist = 0.005 + i * 0.003; // increasing radius
            const lat = baseLat + Math.cos(angle) * dist;
            const lng = baseLng + Math.sin(angle) * dist;
            const latlng = L.latLng(lat, lng);
            bounds.extend(latlng);

            const intensity = z.total / maxVotos;
            const radius = Math.max(24, intensity * 36);
            const color = intensity > 0.6 ? "#dc2626" : intensity > 0.3 ? "#f59e0b" : "#22c55e";

            L.circle(latlng, {
              radius: radius * 200,
              color,
              fillColor: color,
              fillOpacity: 0.2,
              weight: 1,
            }).addTo(heatRef.current!);

            const icon = L.divIcon({
              className: "tse-vote-marker",
              html: `<div style="background:${color};color:white;border-radius:6px;padding:2px 6px;display:flex;align-items:center;gap:3px;font-size:10px;font-weight:bold;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);white-space:nowrap"><span style="opacity:0.8">Z${z.zona}</span> ${z.total.toLocaleString("pt-BR")}</div>`,
              iconSize: [60, 22],
              iconAnchor: [30, 11],
            });

            L.marker(latlng, { icon })
              .bindPopup(`<strong>${z.municipio}</strong><br/>Zona: ${z.zona}<br/>Votos: ${z.total.toLocaleString("pt-BR")}`)
              .addTo(markersRef.current!);
          });

          await new Promise(r => setTimeout(r, 350));
        } catch {}
      }

      if (bounds.isValid() && mapRef.current) {
        mapRef.current.flyToBounds(bounds, { padding: [40, 40], duration: 1 });
      }
    };

    geocodeAndPlot();
  }, [votosPorZona]);

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Search className="h-5 w-5 text-primary" />
          Pesquisa TSE — Histórico Eleitoral
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={`Digite o nome do candidato${anoFiltro ? ` (eleição ${anoFiltro})` : ""}...`}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setSelected(null); }}
            className="pl-9"
          />
        </div>

        {anosDisp.length > 0 && (
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs text-muted-foreground">Ano da eleição:</span>
            <Button
              size="sm"
              variant={anoFiltro === null ? "default" : "outline"}
              onClick={() => { setAnoFiltro(null); setSelected(null); }}
              className="h-7 px-3 text-xs"
            >
              Todos
            </Button>
            {anosDisp.map((a) => (
              <Button
                key={a}
                size="sm"
                variant={anoFiltro === a ? "default" : "outline"}
                onClick={() => { setAnoFiltro(a); setSelected(null); }}
                className="h-7 px-3 text-xs"
              >
                {a}
              </Button>
            ))}
          </div>
        )}

        {isLoading && <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Buscando...</div>}

        {!selected && resultados.length > 0 && (
          <div className="max-h-60 overflow-y-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome Urna</TableHead>
                  <TableHead>Ano</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Partido</TableHead>
                  <TableHead>Município</TableHead>
                  <TableHead>Total Votos</TableHead>
                  <TableHead>Situação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resultados.map((c) => (
                  <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelected(c)}>
                    <TableCell className="font-medium">{c.nome_urna}</TableCell>
                    <TableCell><Badge variant="secondary">{c.ano_eleicao}</Badge></TableCell>
                    <TableCell><Badge variant="outline">{c.cargo}</Badge></TableCell>
                    <TableCell>{c.sigla_partido}</TableCell>
                    <TableCell>{c.municipio}</TableCell>
                    <TableCell><Badge>{c.total_votos.toLocaleString("pt-BR")}</Badge></TableCell>
                    <TableCell>
                      <Badge variant={c.situacao?.includes("ELEITO") ? "default" : "secondary"}>
                        {c.situacao || "—"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {debouncedSearch.length >= 3 && !isLoading && resultados.length === 0 && !selected && (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhum candidato encontrado para "{debouncedSearch}"</p>
        )}

        {selected && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Award className="h-6 w-6 text-primary" />
                <div>
                  <h3 className="font-bold text-lg">{selected.nome_urna}</h3>
                  <p className="text-sm text-muted-foreground">
                    {selected.cargo} • {selected.sigla_partido} • {selected.municipio}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {onUsarDobradinha && (
                  <Button size="sm" onClick={() => onUsarDobradinha(selected.nome_urna, selected.total_votos)}>
                    <UserPlus className="h-4 w-4 mr-1" />
                    Usar como Dobradinha
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => {
                  const headers = ["Município", "Zona", "Votos", "% do Total"];
                  const rows = linhasRelatorio(n => n.toLocaleString("pt-BR"));
                  exportTablePdf(`TSE ${selected.nome_urna} ${selected.ano_eleicao}`, headers, rows);
                  toast.success("PDF gerado!");
                }}>
                  <FileDown className="h-4 w-4 mr-1" /> PDF
                </Button>
                <Button size="sm" variant="outline" onClick={() => {
                  const headers = ["Município", "Zona", "Votos", "% do Total"];
                  const rows = linhasRelatorio(n => String(n));
                  exportTableExcel(`TSE ${selected.nome_urna} ${selected.ano_eleicao}`, headers, rows);
                  toast.success("Excel gerado!");
                }}>
                  <FileDown className="h-4 w-4 mr-1" /> Excel
                </Button>
                <Button size="sm" variant="outline" onClick={() => {
                  const BOM = "\uFEFF";
                  const headers = ["Município", "Zona", "Votos", "% do Total"];
                  const rows = linhasRelatorio(n => String(n));
                  const csv = BOM + [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
                  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `tse-${selected.nome_urna}-${selected.ano_eleicao}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                  toast.success("CSV gerado!");
                }}>
                  <FileDown className="h-4 w-4 mr-1" /> CSV
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setSelected(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card className="bg-primary/5">
                <CardContent className="p-3 text-center">
                  <p className="text-2xl font-bold text-primary">{selected.total_votos.toLocaleString("pt-BR")}</p>
                  <p className="text-xs text-muted-foreground">Total de Votos</p>
                </CardContent>
              </Card>
              <Card className="bg-primary/5">
                <CardContent className="p-3 text-center">
                  <p className="text-2xl font-bold text-primary">{votosPorMunicipio.length}</p>
                  <p className="text-xs text-muted-foreground">Municípios</p>
                </CardContent>
              </Card>
              <Card className="bg-primary/5">
                <CardContent className="p-3 text-center">
                  <p className="text-2xl font-bold text-primary">{maiorVotacao?.municipio || "—"}</p>
                  <p className="text-xs text-muted-foreground">Maior Votação</p>
                </CardContent>
              </Card>
              <Card className="bg-primary/5">
                <CardContent className="p-3 text-center">
                  <Badge variant={selected.situacao?.includes("ELEITO") ? "default" : "secondary"} className="text-sm">
                    {selected.situacao || "—"}
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-1">Resultado</p>
                </CardContent>
              </Card>
            </div>

            {/* Map */}
            <div>
              <h4 className="font-semibold text-sm mb-2 flex items-center gap-1">
                <MapPin className="h-4 w-4" /> Mapa de Votação por Zona Eleitoral
              </h4>
              <div ref={mapContainerRef} className="h-[350px] rounded-lg border" style={{ zIndex: 0 }} />
            </div>

            {/* Table of votos por zona */}
            {loadingVotos ? (
              <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando votos...</div>
            ) : (
              <div className="max-h-[28rem] overflow-y-auto border rounded-md divide-y">
                {gruposCidade.map(g => (
                  <div key={g.municipio}>
                    <div className="sticky top-0 z-[1] flex items-center justify-between gap-2 bg-muted px-3 py-2">
                      <span className="font-bold text-sm">{g.municipio}</span>
                      <span className="text-sm font-bold text-primary whitespace-nowrap">
                        {g.total.toLocaleString("pt-BR")} votos <span className="text-xs font-normal text-muted-foreground">total</span>
                      </span>
                    </div>
                    {g.zonas.map(z => (
                      <div key={z.zona} className="flex items-center justify-between gap-2 px-3 py-1.5 pl-6 text-sm">
                        <span className="text-muted-foreground">Zona {z.zona}</span>
                        <span className="whitespace-nowrap">
                          <span className="font-medium">{z.total.toLocaleString("pt-BR")} votos</span>
                          <span className="ml-2 text-xs text-muted-foreground">{((z.total / (selected.total_votos || 1)) * 100).toFixed(1)}%</span>
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
