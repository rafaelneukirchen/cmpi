import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Loader2, MapPin, Users, FileDown } from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

async function exportMapPdf(
  mapEl: HTMLDivElement | null,
  cidades: CidadePublica[],
  stats: { total: number; comDob: number; dobradas: number }
) {
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  pdf.setFontSize(16);
  pdf.text("Mapa Eleitoral — Dobrada", pageW / 2, 14, { align: "center" });
  pdf.setFontSize(10);
  pdf.text(
    `Cidades: ${stats.total}  •  Com Dobrada: ${stats.comDob}  •  Candidatos parceiros: ${stats.dobradas}`,
    pageW / 2,
    20,
    { align: "center" }
  );

  if (mapEl) {
    try {
      const canvas = await html2canvas(mapEl, { useCORS: true, allowTaint: true, scale: 2, logging: false });
      const img = canvas.toDataURL("image/jpeg", 0.85);
      const maxW = pageW - 20;
      const maxH = 150;
      const ratio = Math.min(maxW / canvas.width, maxH / canvas.height);
      const w = canvas.width * ratio;
      const h = canvas.height * ratio;
      pdf.addImage(img, "JPEG", (pageW - w) / 2, 25, w, h);
    } catch (e) {
      console.warn("Falha ao capturar mapa", e);
    }
  }

  const rows = cidades
    .slice()
    .sort((a, b) => a.nome.localeCompare(b.nome))
    .flatMap((c) => {
      const dobs = Array.from(new Set((c.dobradinhas || []).map((d) => d.candidato_parceiro))).join(", ") || "—";
      const lids = c.liderancas || [];
      if (lids.length === 0) {
        return [[c.nome, dobs, "—", "—"]];
      }
      return lids.map((l) => [
        c.nome,
        dobs,
        l.nome,
        l.votos_estimados ? Number(l.votos_estimados).toLocaleString("pt-BR") : "—",
      ]);
    });

  pdf.addPage();
  pdf.setFontSize(14);
  pdf.text("Cidades, Lideranças e Dobradas", 14, 14);
  autoTable(pdf, {
    startY: 20,
    head: [["Cidade", "Dobrada", "Liderança", "Votos"]],
    body: rows,
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [100, 80, 180] },
  });

  pdf.save(`mapa-eleitoral-${new Date().toISOString().slice(0, 10)}.pdf`);
}

interface CidadePublica {
  id: string;
  nome: string;
  regiao_administrativa: string | null;
  latitude: number | null;
  longitude: number | null;
  coordenador_cor: string | null;
  coordenador_nome: string | null;
  dobradinhas: { candidato_parceiro: string; cargo_parceiro: string | null }[] | null;
  liderancas: { nome: string; votos_estimados: number | null }[] | null;
}

const FALLBACK_COLOR = "#94a3b8";
const DOBRADINHA_RING = "#a855f7";

export default function MapaPublico() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cidades, setCidades] = useState<CidadePublica[]>([]);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  // Fetch data
  useEffect(() => {
    if (!token) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc("get_public_map_data", { p_token: token });
      if (error) {
        setError("Erro ao carregar o mapa.");
        setLoading(false);
        return;
      }
      const res = data as any;
      if (!res?.success) {
        setError(res?.error || "Link inválido");
        setLoading(false);
        return;
      }
      setCidades((res.cidades || []) as CidadePublica[]);
      setLoading(false);
    })();
  }, [token]);

  // Init map
  useEffect(() => {
    if (loading || error || !mapContainerRef.current || mapRef.current) return;
    const map = L.map(mapContainerRef.current, {
      center: [-22.5, -48.5],
      zoom: 7,
      zoomControl: true,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: "© OpenStreetMap",
    }).addTo(map);
    mapRef.current = map;
    layerRef.current = L.layerGroup().addTo(map);
    return () => { map.remove(); mapRef.current = null; };
  }, [loading, error]);

  // Render markers
  useEffect(() => {
    if (!mapRef.current || !layerRef.current) return;
    layerRef.current.clearLayers();
    const bounds = L.latLngBounds([]);
    cidades.forEach((c) => {
      if (!c.latitude || !c.longitude) return;
      const dobs = c.dobradinhas || [];
      const lids = c.liderancas || [];
      const hasDob = dobs.length > 0;
      const color = c.coordenador_cor || FALLBACK_COLOR;
      const size = hasDob ? 22 : 14;
      const ring = hasDob
        ? `border:3px solid ${DOBRADINHA_RING};box-shadow:0 0 8px 2px rgba(168,85,247,0.5);`
        : `border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3);`;
      const icon = L.divIcon({
        className: "pub-marker",
        html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};${ring}"></div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });
      const uniqDobs = Array.from(new Map(dobs.map((d) => [d.candidato_parceiro, d])).values());
      const dobList = uniqDobs.length
        ? `<div style="margin-top:6px;padding-top:6px;border-top:1px solid #e5e7eb"><strong style="color:${DOBRADINHA_RING}">Dobrada:</strong><ul style="margin:4px 0 0 0;padding-left:16px">${uniqDobs
            .map((d) => `<li>${d.candidato_parceiro}${d.cargo_parceiro ? ` <em style="color:#64748b">(${d.cargo_parceiro})</em>` : ""}</li>`)
            .join("")}</ul></div>`
        : "";
      const lidList = lids.length
        ? `<div style="margin-top:6px;padding-top:6px;border-top:1px solid #e5e7eb"><strong>Lideranças:</strong><ul style="margin:4px 0 0 0;padding-left:16px">${lids
            .map((l) => `<li>${l.nome}${l.votos_estimados ? ` <span style="color:#16a34a">— ${Number(l.votos_estimados).toLocaleString("pt-BR")} votos</span>` : ""}</li>`)
            .join("")}</ul></div>`
        : "";
      const popup = `<div style="min-width:200px;font-family:system-ui"><strong>${c.nome}</strong>${
        c.regiao_administrativa ? `<br/><span style="color:#64748b;font-size:12px">${c.regiao_administrativa}</span>` : ""
      }${c.coordenador_nome ? `<br/><span style="font-size:12px">Coordenador: <strong>${c.coordenador_nome}</strong></span>` : ""}${lidList}${dobList}</div>`;
      const m = L.marker([Number(c.latitude), Number(c.longitude)], { icon }).bindPopup(popup);
      m.addTo(layerRef.current!);
      bounds.extend(m.getLatLng());
    });
    if (bounds.isValid()) {
      mapRef.current.fitBounds(bounds, { padding: [30, 30] });
    }
  }, [cidades]);

  const stats = useMemo(() => {
    const total = cidades.length;
    const comDob = cidades.filter((c) => (c.dobradinhas || []).length > 0).length;
    const dobUnicas = new Set<string>();
    cidades.forEach((c) => (c.dobradinhas || []).forEach((d) => dobUnicas.add(d.candidato_parceiro)));
    return { total, comDob, dobradas: dobUnicas.size };
  }, [cidades]);

  const cidadesComDobrada = useMemo(
    () =>
      cidades
        .filter((c) => (c.dobradinhas || []).length > 0)
        .sort((a, b) => a.nome.localeCompare(b.nome)),
    [cidades]
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
            <MapPin className="h-8 w-8 text-red-600" />
          </div>
          <h1 className="text-xl font-bold mb-2">Acesso indisponível</h1>
          <p className="text-slate-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <header className="bg-white border-b shadow-sm px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-lg font-bold flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              Mapa Eleitoral — Dobrada
            </h1>
            <p className="text-xs text-slate-500">Visualização pública compartilhada</p>
          </div>
          <div className="flex gap-4 text-sm items-center">
            <div className="text-center">
              <div className="font-bold text-lg">{stats.total}</div>
              <div className="text-xs text-slate-500">Cidades</div>
            </div>
            <div className="text-center">
              <div className="font-bold text-lg text-purple-600">{stats.comDob}</div>
              <div className="text-xs text-slate-500">Com Dobrada</div>
            </div>
            <div className="text-center">
              <div className="font-bold text-lg">{stats.dobradas}</div>
              <div className="text-xs text-slate-500">Candidatos parceiros</div>
            </div>
            <button
              onClick={() => exportMapPdf(mapContainerRef.current, cidades, stats)}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition"
            >
              <FileDown className="h-4 w-4" /> Baixar PDF
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 space-y-4">
        <div className="max-w-7xl mx-auto h-[calc(100vh-200px)] bg-white rounded-lg shadow-sm overflow-hidden border">
          <div ref={mapContainerRef} className="h-full w-full" style={{ zIndex: 0 }} />
        </div>
        <p className="max-w-7xl mx-auto text-xs text-slate-400 text-center flex items-center justify-center gap-1">
          <Users className="h-3 w-3" /> Cidades coloridas por coordenador • Anéis roxos indicam cidades com dobrada
        </p>

        <div className="max-w-7xl mx-auto">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">
            Cidades com Dobrada ({cidadesComDobrada.length})
          </h2>
          <ol className="list-decimal list-inside space-y-2 bg-white rounded-lg border shadow-sm px-4 py-3">
            {cidadesComDobrada.map((c) => {
              const lids = c.liderancas || [];
              const dobs = Array.from(new Set((c.dobradinhas || []).map((d) => d.candidato_parceiro)));
              return (
                <li key={c.id} className="text-sm text-slate-800">
                  <span className="font-semibold">{c.nome}</span>
                  {dobs.length > 0 && (
                    <span className="text-purple-700"> — Dobrada: {dobs.join(", ")}</span>
                  )}
                  {lids.length > 0 && (
                    <ul className="ml-6 mt-1 list-disc text-xs text-slate-600 space-y-0.5">
                      {lids.map((l, i) => (
                        <li key={i}>
                          <span className="font-medium text-slate-700">{l.nome}</span>
                          {l.votos_estimados ? (
                            <span className="text-green-700"> — {Number(l.votos_estimados).toLocaleString("pt-BR")} votos</span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      </main>
    </div>
  );
}
