import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { useCidades, useProjecoes, useLiderancas, useEstruturas } from "@/hooks/useSupabaseData";
import { useDobradinhas } from "@/hooks/useDobradinhas";
import { useCoordenadores } from "@/hooks/useCoordenadores";
import { useCabosEleitorais } from "@/hooks/useCabosEleitorais";
import { useEleitoresCaptados } from "@/hooks/useEleitoresCaptados";
import { useTseVotosReferencia, normalizeCidade, CANDIDATO_REFERENCIA, ANO_REFERENCIA } from "@/hooks/useTseVotosReferencia";

import { calcularPrioridades } from "@/hooks/useCidadePrioridade";
import PainelPrioridades from "@/components/PainelPrioridades";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { X, Loader2, Plus, UserPlus, Unlink, Search, Palette, Share2, FileDown } from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import LiderancaFormDialog from "@/components/LiderancaFormDialog";
import CaboEleitoralFormDialog from "@/components/CaboEleitoralFormDialog";
import ProjecaoFormDialog from "@/components/ProjecaoFormDialog";
import DobradinhaFormDialog from "@/components/DobradinhaFormDialog";
import AssociarLiderancaDialog from "@/components/AssociarLiderancaDialog";
import MapaPublicoLinksDialog from "@/components/MapaPublicoLinksDialog";
import { useAuth } from "@/hooks/useAuth";

const COORD_COLORS = [
  "#2563eb", "#d946ef", "#f97316", "#0891b2", "#84cc16",
  "#e11d48", "#8b5cf6", "#14b8a6", "#f59e0b", "#6366f1",
  "#059669", "#b91c1c", "#7c3aed", "#0284c7", "#ca8a04",
  "#db2777", "#4f46e5", "#0d9488", "#c2410c", "#7e22ce",
  "#15803d", "#be123c", "#1d4ed8", "#a16207", "#9333ea",
  "#0e7490", "#dc2626", "#4338ca", "#65a30d", "#c026d3",
];

const DOB_COLORS = [
  "#a855f7", "#ec4899", "#f43f5e", "#06b6d4", "#10b981",
  "#f59e0b", "#8b5cf6", "#ef4444", "#3b82f6", "#14b8a6",
  "#d946ef", "#84cc16", "#6366f1", "#f97316", "#0891b2",
];

const LIDERANCA_COLORS = [
  "#e11d48", "#2563eb", "#16a34a", "#d946ef", "#f97316",
  "#0891b2", "#8b5cf6", "#84cc16", "#f59e0b", "#6366f1",
  "#14b8a6", "#ec4899", "#f43f5e", "#06b6d4", "#10b981",
];


function createIcon(color: string, hasLideranca: boolean, hasDobradinha: boolean) {
  const size = hasDobradinha ? 24 : hasLideranca ? 22 : 18;
  const ring = hasDobradinha
    ? `border:3px solid #a855f7;box-shadow:0 0 8px 2px rgba(168,85,247,0.5),0 2px 6px rgba(0,0,0,0.3);`
    : hasLideranca
    ? `border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.35);`
    : `border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.2);`;

  const star = hasDobradinha
    ? `<div style="position:absolute;top:-6px;right:-6px;width:14px;height:14px;border-radius:50%;background:#a855f7;border:2px solid white;display:flex;align-items:center;justify-content:center;font-size:8px;color:white;font-weight:bold;">★</div>`
    : '';

  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="position:relative;width:${size}px;height:${size}px;border-radius:50%;background:${color};${ring}">${star}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}


export default function MapaEleitoral() {
  const [selectedCidadeId, setSelectedCidadeId] = useState<string | null>(null);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const { userRole } = useAuth();
  const isCoord = userRole === "coordenador_estadual" || userRole === "coordenador_regional";
  const [mapaMode, setMapaMode] = useState<"minhas" | "geral">("minhas");
  const [filterRegiao, setFilterRegiao] = useState("todas");
  const [filterForca, setFilterForca] = useState("todas");
  const [filterDobradinha, setFilterDobradinha] = useState("todas");
  const [filterCoord, setFilterCoord] = useState("todos");
  const [filterPrioridade, setFilterPrioridade] = useState("todas");
  const [filterLideranca, setFilterLideranca] = useState("todas");
  const [searchCity, setSearchCity] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [colorByDobrada, setColorByDobrada] = useState(false);
  const [mapLayer, setMapLayer] = useState<"padrao" | "satelite" | "hibrido">("padrao");
  const [streetViewMode, setStreetViewMode] = useState(false);
  const [streetViewPoint, setStreetViewPoint] = useState<{ lat: number; lng: number } | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  const markersRef = useRef<L.Marker[]>([]);
  const bairroMarkersRef = useRef<L.LayerGroup | null>(null);
  const eleitoresLayerRef = useRef<L.LayerGroup | null>(null);
  const highlightRef = useRef<L.GeoJSON | null>(null);
  const liderancaRegionRef = useRef<Map<string, { lat: number; lng: number }>>(new Map());
  const ibgeCodesRef = useRef<Map<string, number> | null>(null);
  const boundaryCache = useRef<Map<string, any>>(new Map());
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const labelsLayerRef = useRef<L.TileLayer | null>(null);
  const streetViewModeRef = useRef(false);

  const { data: cidades = [], isLoading: lc } = useCidades();
  const { data: projecoes = [], isLoading: lp } = useProjecoes();
  const { data: liderancas = [] } = useLiderancas();
  const { data: cabos = [] } = useCabosEleitorais();
  const { data: estruturas = [] } = useEstruturas();
  const { data: dobradinhas = [] } = useDobradinhas();
  const { data: coordenadores = [] } = useCoordenadores();
  const { data: eleitoresCaptadosFiltro = [] } = useEleitoresCaptados(filterLideranca !== "todas" ? filterLideranca : undefined);
  const { data: votosTseMap } = useTseVotosReferencia();


  const isGeralMode = isCoord && mapaMode === "geral";
  const { data: mapaGeral = [] } = useQuery({
    queryKey: ["mapa-geral-cidades"],
    enabled: isGeralMode,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_mapa_geral_cidades");
      if (error) throw error;
      return (data || []) as {
        id: string; nome: string; regiao_administrativa: string | null;
        latitude: number | null; longitude: number | null; cor: string | null;
        tem_lideranca: boolean; tem_dobradinha: boolean; qtd_liderancas: number;
      }[];
    },
  });


  const projMap = useMemo(() => new Map(projecoes.map(p => [p.cidade_id, p])), [projecoes]);
  const liderancaMap = useMemo(() => new Map(liderancas.map(l => [l.id, l])), [liderancas]);
  const estruturaMap = useMemo(() => new Map(estruturas.map(e => [e.cidade_id, e])), [estruturas]);
  const coordColorMap = useMemo(() => {
    const map = new Map<string, string>();
    const usedColors = new Set<string>();

    // First pass: register colors already saved in profiles
    coordenadores.forEach(c => {
      if (c.cor) usedColors.add(c.cor.toLowerCase());
    });

    // Second pass: assign colors, preferring saved ones
    coordenadores.forEach((c, i) => {
      if (c.cor) {
        map.set(c.user_id, c.cor);
        return;
      }
      // Find an unused color from the palette
      let color = '';
      for (let j = 0; j < COORD_COLORS.length; j++) {
        const candidate = COORD_COLORS[(i + j) % COORD_COLORS.length];
        if (!usedColors.has(candidate.toLowerCase())) {
          color = candidate;
          break;
        }
      }
      if (!color) {
        // Generate a unique color via hue rotation to avoid duplicates
        const hue = (i * 137.508) % 360;
        color = `hsl(${Math.round(hue)}, 70%, 45%)`;
      }
      usedColors.add(color.toLowerCase());
      map.set(c.user_id, color);
    });
    return map;
  }, [coordenadores]);

  // Auto-persist colors for coordinators who don't have one saved yet
  useEffect(() => {
    coordenadores.forEach(c => {
      if (!c.cor && coordColorMap.has(c.user_id)) {
        const autoColor = coordColorMap.get(c.user_id)!;
        supabase.from("profiles").update({ cor: autoColor } as any).eq("user_id", c.user_id).then();
      }
    });
  }, [coordenadores, coordColorMap]);

  // Per-city color override from coordenador_cor field
  const cidadeColorOverride = useMemo(() => {
    const map = new Map<string, string>();
    cidades.forEach(c => {
      if ((c as any).coordenador_cor) {
        map.set(c.id, (c as any).coordenador_cor);
      }
    });
    return map;
  }, [cidades]);
  const coordNameMap = useMemo(() => new Map(coordenadores.map(c => [c.user_id, c.nome])), [coordenadores]);

  const dobradinhasByCidade = useMemo(() => {
    const map = new Map<string, typeof dobradinhas>();
    const addTo = (cidadeId: string, d: typeof dobradinhas[number]) => {
      const arr = map.get(cidadeId) || [];
      if (!arr.includes(d)) arr.push(d);
      map.set(cidadeId, arr);
    };
    dobradinhas.forEach(d => {
      const cidadeIds = new Set<string>();
      if (d.cidade_id) cidadeIds.add(d.cidade_id);
      if (d.lideranca_id) {
        const lid = liderancaMap.get(d.lideranca_id);
        if (lid?.cidade_base_id) cidadeIds.add(lid.cidade_base_id);
        ((lid?.cidades_representadas as string[]) || []).forEach(c => cidadeIds.add(c));
      }
      cidadeIds.forEach(cid => addTo(cid, d));
    });
    return map;
  }, [dobradinhas, liderancaMap]);

  // Map each unique candidato_parceiro to a color
  const dobColorMap = useMemo(() => {
    const names = [...new Set(dobradinhas.map(d => d.candidato_parceiro))].sort();
    const map = new Map<string, string>();
    names.forEach((name, i) => map.set(name, DOB_COLORS[i % DOB_COLORS.length]));
    return map;
  }, [dobradinhas]);

  const liderancasByCidade = useMemo(() => {
    const map = new Map<string, typeof liderancas>();
    liderancas.forEach(l => {
      if (l.cidade_base_id) {
        const arr = map.get(l.cidade_base_id) || [];
        arr.push(l);
        map.set(l.cidade_base_id, arr);
      }
      (l.cidades_representadas as string[] || []).forEach(cid => {
        const arr = map.get(cid) || [];
        arr.push(l);
        map.set(cid, arr);
      });
    });
    return map;
  }, [liderancas]);

  // Cabos eleitorais vinculados a cidades (base + representadas)
  const cabosByCidade = useMemo(() => {
    const map = new Map<string, typeof cabos>();
    const add = (cid: string, c: typeof cabos[number]) => {
      const arr = map.get(cid) || [];
      if (!arr.includes(c)) arr.push(c);
      map.set(cid, arr);
    };
    cabos.forEach(c => {
      if (c.cidade_base_id) add(c.cidade_base_id, c);
      ((c as any).cidades_representadas as string[] || []).forEach(cid => add(cid, c));
    });
    return map;
  }, [cabos]);

  // Coordenador de cada cabo (próprio ou herdado da liderança)
  const caboCoordId = useCallback((c: any) => {
    return c.coordenador_user_id || liderancaMap.get(c.lider_id)?.coordenador_user_id || null;
  }, [liderancaMap]);

  const votosEstimadosByCidade = useMemo(() => {
    const map = new Map<string, number>();
    liderancas.forEach(l => {
      const votos = l.votos_estimados || 0;
      if (votos > 0) {
        if (l.cidade_base_id) map.set(l.cidade_base_id, (map.get(l.cidade_base_id) || 0) + votos);
        (l.cidades_representadas as string[] || []).forEach(cid => {
          map.set(cid, (map.get(cid) || 0) + votos);
        });
      }
    });
    cabosByCidade.forEach((cbs, cid) => {
      cbs.forEach(c => {
        const vpc = ((c as any).votos_por_cidade || {}) as Record<string, number>;
        const votos = Number(vpc[cid] ?? 0) || (c.votos_estimados || 0);
        if (votos > 0) map.set(cid, (map.get(cid) || 0) + votos);
      });
    });
    return map;
  }, [liderancas, cabosByCidade]);

  const coordDominanteByCidade = useMemo(() => {
    const map = new Map<string, string | null>();
    const cidadeIds = new Set<string>([...liderancasByCidade.keys(), ...cabosByCidade.keys()]);
    cidadeIds.forEach(cidId => {
      const counts = new Map<string, number>();
      (liderancasByCidade.get(cidId) || []).forEach(l => { if (l.coordenador_user_id) counts.set(l.coordenador_user_id, (counts.get(l.coordenador_user_id) || 0) + 1); });
      (cabosByCidade.get(cidId) || []).forEach(c => { const uid = caboCoordId(c); if (uid) counts.set(uid, (counts.get(uid) || 0) + 1); });
      let max = 0, dominant: string | null = null;
      counts.forEach((v, k) => { if (v > max) { max = v; dominant = k; } });
      map.set(cidId, dominant);
    });
    return map;
  }, [liderancasByCidade, cabosByCidade, caboCoordId]);

  // === PRIORIDADES ===
  const prioridades = useMemo(() =>
    calcularPrioridades({ cidades, projMap, votosEstimadosByCidade, liderancasByCidade, estruturaMap }),
    [cidades, projMap, votosEstimadosByCidade, liderancasByCidade, estruturaMap]
  );
  const prioridadeMap = useMemo(() => new Map(prioridades.map(p => [p.cidadeId, p])), [prioridades]);

  const regioes = useMemo(() => [...new Set(cidades.map(c => c.regiao_administrativa).filter(Boolean))], [cidades]);

  const filteredCidades = useMemo(() => cidades.filter(c => {
    if (filterRegiao !== "todas" && c.regiao_administrativa !== filterRegiao) return false;
    if (filterDobradinha === "com" && !dobradinhasByCidade.has(c.id)) return false;
    if (filterDobradinha === "sem" && dobradinhasByCidade.has(c.id)) return false;

    if (filterCoord !== "todos") {
      const cityLids = liderancasByCidade.get(c.id) || [];
      const cityCabos = cabosByCidade.get(c.id) || [];
      const coordIds = [
        ...cityLids.map(l => l.coordenador_user_id),
        ...cityCabos.map(cb => caboCoordId(cb)),
      ].filter(Boolean) as string[];
      const total = cityLids.length + cityCabos.length;
      if (filterCoord === "sem_coordenador") {
        if (coordIds.length > 0 || total === 0) return false;
      } else {
        if (!coordIds.includes(filterCoord)) return false;
      }
    }

    if (filterPrioridade !== "todas") {
      const prio = prioridadeMap.get(c.id);
      if (!prio && filterPrioridade !== "baixa") return false;
      if (prio && prio.nivel !== filterPrioridade) return false;
    }

    if (filterForca !== "todas") {
      const proj = projMap.get(c.id);
      const estVotos = votosEstimadosByCidade.get(c.id) || 0;
      const metaVotos = proj?.meta_votos || 0;
      const votosBase = (proj?.votos_projetados || 0) || estVotos;
      if (!metaVotos && !votosBase) return filterForca === "sem_projecao";
      if (!metaVotos) return filterForca !== "sem_projecao";
      const ratio = votosBase / metaVotos;
      if (filterForca === "alta" && ratio < 0.75) return false;
      if (filterForca === "media" && (ratio < 0.5 || ratio >= 0.75)) return false;
      if (filterForca === "baixa" && ratio >= 0.5) return false;
      if (filterForca === "sem_projecao") return false;
    }
    return true;
  }), [cidades, filterRegiao, filterForca, filterDobradinha, filterCoord, filterPrioridade, projMap, dobradinhasByCidade, liderancasByCidade, cabosByCidade, caboCoordId, votosEstimadosByCidade, prioridadeMap]);

  const clearHighlight = useCallback(() => {
    if (highlightRef.current) {
      highlightRef.current.remove();
      highlightRef.current = null;
    }
  }, []);

  // Load IBGE municipality codes for SP (state code 35) once
  const loadIbgeCodes = useCallback(async () => {
    if (ibgeCodesRef.current) return ibgeCodesRef.current;
    try {
      const res = await fetch('https://servicodados.ibge.gov.br/api/v1/localidades/estados/35/municipios');
      const data = await res.json();
      const map = new Map<string, number>();
      data.forEach((m: any) => {
        map.set(m.nome.toLowerCase(), m.id);
      });
      ibgeCodesRef.current = map;
      return map;
    } catch (e) {
      console.warn('Failed to load IBGE codes:', e);
      return new Map<string, number>();
    }
  }, []);

  const fetchBoundary = useCallback(async (cityName: string): Promise<any | null> => {
    const cached = boundaryCache.current.get(cityName.toLowerCase());
    if (cached) return cached;

    const codes = await loadIbgeCodes();
    const ibgeId = codes.get(cityName.toLowerCase());
    if (!ibgeId) return null;

    try {
      const res = await fetch(`https://servicodados.ibge.gov.br/api/v3/malhas/municipios/${ibgeId}?formato=application/vnd.geo+json`);
      const geojson = await res.json();
      boundaryCache.current.set(cityName.toLowerCase(), geojson);
      return geojson;
    } catch (e) {
      console.warn(`Failed to fetch boundary for ${cityName}:`, e);
      return null;
    }
  }, [loadIbgeCodes]);

  const showBoundary = useCallback(async (cityName: string, lat: number, lng: number) => {
    if (!mapRef.current) return;
    clearHighlight();

    const geojson = await fetchBoundary(cityName);
    if (geojson && mapRef.current) {
      highlightRef.current = L.geoJSON(geojson, {
        style: {
          color: '#2563eb',
          weight: 3,
          fillColor: '#2563eb',
          fillOpacity: 0.15,
          dashArray: '8, 6',
        },
      }).addTo(mapRef.current);

      // Fit map to boundary bounds
      const bounds = highlightRef.current.getBounds();
      if (bounds.isValid()) {
        mapRef.current.flyToBounds(bounds, { padding: [40, 40], duration: 1 });
      }
    } else if (mapRef.current) {
      // Fallback to flyTo if boundary not available
      mapRef.current.flyTo([lat, lng], 12, { duration: 1 });
    }
  }, [clearHighlight, fetchBoundary]);

  const focusOnLocation = useCallback((lat: number, lng: number, zoom = 12, _radius = 3000) => {
    if (!mapRef.current) return;
    mapRef.current.flyTo([lat, lng], zoom, { duration: 1 });
    clearHighlight();
  }, [clearHighlight]);

  const handleSelectPrioridade = useCallback((cidadeId: string) => {
    setSelectedCidadeId(cidadeId);
    const cidade = cidades.find(ci => ci.id === cidadeId);
    if (cidade?.latitude && cidade?.longitude) {
      showBoundary(cidade.nome, Number(cidade.latitude), Number(cidade.longitude));
    }
  }, [cidades, showBoundary]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    // Guard against StrictMode double-mount: container may already have leaflet id
    if ((mapContainerRef.current as any)._leaflet_id) {
      delete (mapContainerRef.current as any)._leaflet_id;
    }
    mapContainerRef.current.style.background = '#e5e7eb';
    mapRef.current = L.map(mapContainerRef.current, { preferCanvas: false }).setView([-22.5, -48.5], 7);
    // Initial tile layer is added by the mapLayer effect to avoid double-add races

    // Click handler for Street View
    mapRef.current.on('click', (e: L.LeafletMouseEvent) => {
      if (!streetViewModeRef.current) return;
      const { lat, lng } = e.latlng;
      setStreetViewPoint({ lat, lng });
    });

    // Fix Leaflet rendering when container size changes
    const containerEl = mapContainerRef.current;
    const resizeObserver = new ResizeObserver(() => {
      mapRef.current?.invalidateSize();
    });
    resizeObserver.observe(containerEl);

    // CRITICAL: Force invalidateSize multiple times after mount to fix
    // blank-tile issue when entering the page on a fresh session (sidebar/layout
    // animation has not finished when Leaflet measures the container).
    const invalidateTimers: number[] = [];
    [50, 150, 350, 700, 1200, 2000, 3000].forEach((ms) => {
      const id = window.setTimeout(() => {
        mapRef.current?.invalidateSize();
      }, ms);
      invalidateTimers.push(id);
    });

    // Also re-invalidate when window regains focus / becomes visible
    const onVisible = () => {
      mapRef.current?.invalidateSize();
      // Double-tap after a short delay to catch late layout shifts
      setTimeout(() => mapRef.current?.invalidateSize(), 200);
    };
    window.addEventListener('focus', onVisible);
    window.addEventListener('resize', onVisible);
    document.addEventListener('visibilitychange', onVisible);

    // IntersectionObserver: invalidate when container actually becomes visible
    // (handles cases where the map tab/route renders while off-screen)
    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            mapRef.current?.invalidateSize();
            setTimeout(() => mapRef.current?.invalidateSize(), 100);
            setTimeout(() => mapRef.current?.invalidateSize(), 500);
          }
        });
      },
      { threshold: 0.1 }
    );
    intersectionObserver.observe(containerEl);

    // Periodic check for the first 5 seconds — catches all edge cases
    // (Capacitor app resume, slow mobile rendering, CSS transitions)
    let periodicCount = 0;
    const periodicId = window.setInterval(() => {
      mapRef.current?.invalidateSize();
      periodicCount++;
      if (periodicCount >= 10) clearInterval(periodicId);
    }, 500);

    return () => {
      invalidateTimers.forEach(clearTimeout);
      clearInterval(periodicId);
      window.removeEventListener('focus', onVisible);
      window.removeEventListener('resize', onVisible);
      document.removeEventListener('visibilitychange', onVisible);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
      tileLayerRef.current = null;
      labelsLayerRef.current = null;
    };
  }, []);

  // Render captured voters as pins when filtering by a specific liderança
  useEffect(() => {
    if (!mapRef.current) return;
    if (eleitoresLayerRef.current) {
      mapRef.current.removeLayer(eleitoresLayerRef.current);
      eleitoresLayerRef.current = null;
    }
    if (filterLideranca === "todas") return;

    const lid = liderancaMap.get(filterLideranca);
    const color = lid?.coordenador_user_id ? (coordColorMap.get(lid.coordenador_user_id) || "#3b82f6") : "#3b82f6";
    const group = L.layerGroup().addTo(mapRef.current);
    const points: [number, number][] = [];

    eleitoresCaptadosFiltro.forEach(e => {
      if (typeof e.latitude !== "number" || typeof e.longitude !== "number") return;
      points.push([e.latitude, e.longitude]);
      const icon = L.divIcon({
        className: 'eleitor-marker',
        html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.4);"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });
      const popup = `<div style="font-size:12px;"><strong>${e.nome_completo}</strong>${e.bairro ? `<br/>${e.bairro}` : ''}${e.cidade_nome ? ` · ${e.cidade_nome}` : ''}${e.telefone ? `<br/>📞 ${e.telefone}` : ''}<br/><em style="color:#888;">Captado em ${new Date(e.created_at).toLocaleDateString('pt-BR')}</em></div>`;
      L.marker([e.latitude, e.longitude], { icon }).bindPopup(popup).addTo(group);
    });
    eleitoresLayerRef.current = group;

    if (points.length > 0) {
      const bounds = L.latLngBounds(points);
      mapRef.current.flyToBounds(bounds, { padding: [60, 60], maxZoom: 15, duration: 1 });
    }
  }, [filterLideranca, eleitoresCaptadosFiltro, liderancaMap, coordColorMap]);

  // Switch tile layer when mapLayer changes
  useEffect(() => {
    if (!mapRef.current) return;
    if (tileLayerRef.current) {
      mapRef.current.removeLayer(tileLayerRef.current);
      tileLayerRef.current = null;
    }
    if (labelsLayerRef.current) {
      mapRef.current.removeLayer(labelsLayerRef.current);
      labelsLayerRef.current = null;
    }

    if (mapLayer === "padrao") {
      tileLayerRef.current = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 19,
      }).addTo(mapRef.current);
    } else if (mapLayer === "satelite") {
      tileLayerRef.current = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { attribution: 'Tiles &copy; Esri', maxZoom: 19 }
      ).addTo(mapRef.current);
    } else {
      // híbrido: satélite + rótulos
      tileLayerRef.current = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { attribution: 'Tiles &copy; Esri', maxZoom: 19 }
      ).addTo(mapRef.current);
      labelsLayerRef.current = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 19, opacity: 0.9 }
      ).addTo(mapRef.current);
    }
  }, [mapLayer]);

  // Sync street view mode and cursor
  useEffect(() => {
    streetViewModeRef.current = streetViewMode;
    if (!streetViewMode) setStreetViewPoint(null);
    if (mapContainerRef.current) {
      mapContainerRef.current.style.cursor = streetViewMode ? 'crosshair' : '';
    }
  }, [streetViewMode]);

  useEffect(() => {
    if (!mapRef.current) return;
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    // General anonymized view for coordinators — just colored dots, no team data
    if (isGeralMode) {
      const bounds = L.latLngBounds([]);
      mapaGeral.forEach(c => {
        if (!c.latitude || !c.longitude) return;
        const color = c.cor || (c.tem_lideranca ? '#60a5fa' : '#9ca3af');
        const marker = L.marker([Number(c.latitude), Number(c.longitude)], {
          icon: createIcon(color, c.tem_lideranca, c.tem_dobradinha),
        })
          .addTo(mapRef.current!)
          .bindPopup(
            `<strong>${c.nome}</strong>${c.regiao_administrativa ? `<br/><span style="color:#64748b;font-size:11px">${c.regiao_administrativa}</span>` : ''}${c.tem_lideranca ? '<br/><span style="color:#2563eb;font-size:11px">✓ Com liderança cadastrada</span>' : '<br/><span style="color:#94a3b8;font-size:11px">Sem liderança</span>'}`
          );
        markersRef.current.push(marker);
        bounds.extend(marker.getLatLng());
      });
      if (bounds.isValid()) {
        mapRef.current.fitBounds(bounds, { padding: [30, 30] });
      }
      return;
    }

    filteredCidades.forEach(cidade => {
      if (!cidade.latitude || !cidade.longitude) return;
      const proj = projMap.get(cidade.id);
      const hasDob = dobradinhasByCidade.has(cidade.id);
      const cityLids = liderancasByCidade.get(cidade.id) || [];
      const cityCabos = cabosByCidade.get(cidade.id) || [];
      const hasLideranca = cityLids.length > 0 || cityCabos.length > 0;
      const estVotos = votosEstimadosByCidade.get(cidade.id) || 0;
      const coordDominante = coordDominanteByCidade.get(cidade.id);
      const prio = prioridadeMap.get(cidade.id);

      let color = '#9ca3af';
      if (colorByDobrada && hasDob) {
        const firstDob = dobradinhasByCidade.get(cidade.id)![0];
        color = dobColorMap.get(firstDob.candidato_parceiro) || '#a855f7';
      } else if (colorByDobrada && !hasDob) {
        color = '#d1d5db';
      } else if (cidadeColorOverride.has(cidade.id)) {
        color = cidadeColorOverride.get(cidade.id)!;
      } else if (coordDominante && coordColorMap.has(coordDominante)) {
        color = coordColorMap.get(coordDominante)!;
      } else if (proj && proj.meta_votos) {
        const votosBase = (proj.votos_projetados || 0) || estVotos;
        const ratio = votosBase / proj.meta_votos;
        color = ratio >= 0.75 ? '#16a34a' : ratio >= 0.5 ? '#eab308' : '#dc2626';
      } else if (hasLideranca) {
        color = '#60a5fa';
      }

      const dobInfo = hasDob ? dobradinhasByCidade.get(cidade.id)! : [];
      const dobText = hasDob ? `<br/>★ ${dobInfo.length} dobrada(s) - ${dobInfo.reduce((s, d) => s + (d.votos_estimados || 0), 0).toLocaleString('pt-BR')} votos` : '';
      const lidBairros = cityLids.filter(l => (l as any).bairros?.length > 0).map(l => `${l.nome} (${((l as any).bairros as string[]).join(', ')})`);
      const lidDetalhes = cityLids.length > 0
        ? cityLids.map(l => {
            const vpc = ((l as any).votos_por_cidade || {}) as Record<string, number>;
            const v = Number(vpc[cidade.id] ?? 0) || 0;
            return `<li>${l.nome}${v > 0 ? ` — <strong>${v.toLocaleString('pt-BR')}</strong> votos est. nesta cidade` : ''}</li>`;
          }).join('')
        : '';
      const caboDetalhes = cityCabos.length > 0
        ? cityCabos.map(cb => {
            const vpc = ((cb as any).votos_por_cidade || {}) as Record<string, number>;
            const v = Number(vpc[cidade.id] ?? 0) || 0;
            return `<li>🤝 ${cb.nome}${v > 0 ? ` — <strong>${v.toLocaleString('pt-BR')}</strong> votos est. nesta cidade` : ''}</li>`;
          }).join('')
        : '';
      const lidText = hasLideranca
        ? `<br/>👥 <strong>${cityLids.length}</strong> liderança(s) e <strong>${cityCabos.length}</strong> cabo(s) — <strong>${estVotos.toLocaleString('pt-BR')}</strong> votos est. nesta cidade<ul style="margin:4px 0 0 0;padding-left:18px;font-size:11px;">${lidDetalhes}${caboDetalhes}</ul>${lidBairros.length > 0 ? '📍 ' + lidBairros.join('; ') : ''}`
        : '';
      const coordText = coordDominante ? `<br/>📋 ${coordNameMap.get(coordDominante) || 'Coordenador'}` : '';
      const prioText = prio && (prio.nivel === 'critica' || prio.nivel === 'alta')
        ? `<br/><span style="color:${prio.nivel === 'critica' ? '#dc2626' : '#f59e0b'};font-weight:bold;">⚠ Prioridade ${prio.nivel} (${prio.motivos.join(', ')})</span>`
        : '';

      const marker = L.marker([Number(cidade.latitude), Number(cidade.longitude)], {
        icon: createIcon(color, hasLideranca, hasDob),
      })
        .addTo(mapRef.current!)
        .bindPopup(`<strong>${cidade.nome}</strong><br/>Pop: ${(cidade.populacao || 0).toLocaleString('pt-BR')}${coordText}${lidText}${dobText}${prioText}`)
        .on('click', () => {
          handleSelectPrioridade(cidade.id);
        });
      markersRef.current.push(marker);
    });
  }, [isGeralMode, mapaGeral, filteredCidades, projMap, dobradinhasByCidade, liderancasByCidade, cabosByCidade, votosEstimadosByCidade, coordDominanteByCidade, coordColorMap, coordNameMap, prioridadeMap, colorByDobrada, dobColorMap, cidadeColorOverride, handleSelectPrioridade]);


  const selected = selectedCidadeId ? cidades.find(c => c.id === selectedCidadeId) : null;
  const selectedProj = selected ? projMap.get(selected.id) : null;
  const selectedEstrutura = selected ? estruturaMap.get(selected.id) : null;
  const selectedDobradinhas = selected ? dobradinhasByCidade.get(selected.id) || [] : [];
  const selectedEstVotos = selected ? votosEstimadosByCidade.get(selected.id) || 0 : 0;
  const selectedPrio = selected ? prioridadeMap.get(selected.id) : null;
  const selectedVotosTse = selected ? votosTseMap?.get(normalizeCidade(selected.nome)) || null : null;


  const linkedLiderancas = useMemo(() => {
    if (!selected) return [];
    return liderancas.filter(l =>
      l.cidade_base_id === selected.id ||
      (l.cidades_representadas as string[] || []).includes(selected.id)
    );
  }, [selected, liderancas]);

  const linkedCabos = useMemo(() => {
    if (!selected) return [];
    const liderIds = new Set(linkedLiderancas.map(l => l.id));
    return cabos.filter(c => (c.cidade_base_id === selected.id) || (((c as any).cidades_representadas as string[] || []).includes(selected.id)) || liderIds.has(c.lider_id));
  }, [selected, cabos, linkedLiderancas]);

  const linkedCoordenadores = useMemo(() => {
    if (!selected) return [] as { user_id: string; nome: string; cor?: string | null }[];
    const ids = new Set<string>();
    for (const l of linkedLiderancas) if (l.coordenador_user_id) ids.add(l.coordenador_user_id);
    return Array.from(ids).map(uid => ({
      user_id: uid,
      nome: coordNameMap.get(uid) || "Coordenador",
      cor: coordColorMap.get(uid),
    }));
  }, [selected, linkedLiderancas, coordNameMap, coordColorMap]);

  // === Painel votos por cidade da liderança filtrada + total do coordenador ===
  const filteredLiderancaInfo = useMemo(() => {
    if (filterLideranca === "todas") return null;
    const lid = liderancaMap.get(filterLideranca);
    if (!lid) return null;
    const votosPorCidade = ((lid as any).votos_por_cidade || {}) as Record<string, number>;
    const totalEstimado = lid.votos_estimados || 0;
    const cidadesIds = new Set<string>([
      ...(lid.cidade_base_id ? [lid.cidade_base_id] : []),
      ...((lid.cidades_representadas as string[]) || []),
      ...Object.keys(votosPorCidade),
    ]);
    const linhas = Array.from(cidadesIds).map(cid => ({
      cidadeId: cid,
      cidadeNome: cidades.find(c => c.id === cid)?.nome || "—",
      votos: Number(votosPorCidade[cid] || 0),
    })).sort((a, b) => b.votos - a.votos);
    const somaCidades = linhas.reduce((s, l) => s + l.votos, 0);

    // Total do coordenador: soma de votos_estimados de todas as lideranças desse coordenador
    const coordId = lid.coordenador_user_id;
    const coordNome = coordId ? coordNameMap.get(coordId) : null;
    const totalCoordenador = coordId
      ? liderancas.filter(l => l.coordenador_user_id === coordId).reduce((s, l) => s + (l.votos_estimados || 0), 0)
      : 0;
    const qtdLiderancasCoord = coordId
      ? liderancas.filter(l => l.coordenador_user_id === coordId).length
      : 0;

    return { lid, linhas, somaCidades, totalEstimado, coordId, coordNome, totalCoordenador, qtdLiderancasCoord };
  }, [filterLideranca, liderancaMap, cidades, coordNameMap, liderancas]);


  // === BAIRRO MARKERS: geocode and show when a city is selected ===
  const [bairroGeocoding, setBairroGeocoding] = useState(false);

  useEffect(() => {
    if (bairroMarkersRef.current) {
      bairroMarkersRef.current.clearLayers();
      bairroMarkersRef.current.remove();
      bairroMarkersRef.current = null;
    }
    if (!mapRef.current || !selected) return;

    const cityLids = linkedLiderancas.filter(l => (l as any).bairros?.length > 0);
    liderancaRegionRef.current = new Map();
    if (cityLids.length === 0) return;

    const group = L.layerGroup().addTo(mapRef.current);
    bairroMarkersRef.current = group;

    // Collect all bairros with their lideranca info
    const bairroItems: { bairro: string; lideranca: typeof liderancas[0]; color: string }[] = [];
    cityLids.forEach((l, lIdx) => {
      const color = LIDERANCA_COLORS[lIdx % LIDERANCA_COLORS.length];
      ((l as any).bairros as string[]).forEach(bairro => {
        bairroItems.push({ bairro, lideranca: l, color });
      });
    });

    // Geocode cache to avoid duplicate requests
    const cache = new Map<string, { lat: number; lng: number } | null>();

    async function geocodeBairro(bairro: string, cidadeNome: string): Promise<{ lat: number; lng: number } | null> {
      const key = `${bairro}-${cidadeNome}`;
      if (cache.has(key)) return cache.get(key)!;

      try {
        const query = `${bairro}, ${cidadeNome}, São Paulo, Brazil`;
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&countrycodes=br`,
          { headers: { 'User-Agent': 'VotoCompass/1.0' } }
        );
        const data = await res.json();
        if (data.length > 0) {
          const result = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
          cache.set(key, result);
          return result;
        }
      } catch (e) {
        console.warn(`Geocoding failed for ${bairro}:`, e);
      }
      cache.set(key, null);
      return null;
    }

    let cancelled = false;
    setBairroGeocoding(true);

    (async () => {
      const cityLat = Number(selected.latitude);
      const cityLng = Number(selected.longitude);

      for (let i = 0; i < bairroItems.length; i++) {
        if (cancelled) return;
        const { bairro, lideranca, color } = bairroItems[i];

        // Rate limit: 1 req/sec for Nominatim
        if (i > 0) await new Promise(r => setTimeout(r, 1100));
        if (cancelled) return;

        const coords = await geocodeBairro(bairro, selected.nome);
        if (cancelled) return;

        const lat = coords?.lat ?? cityLat + (Math.random() - 0.5) * 0.02;
        const lng = coords?.lng ?? cityLng + (Math.random() - 0.5) * 0.02;

        if (!liderancaRegionRef.current.has(lideranca.id)) {
          liderancaRegionRef.current.set(lideranca.id, { lat, lng });
        }

        const icon = L.divIcon({
          className: 'bairro-marker',
          html: `<div style="width:16px;height:16px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 6px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;"><span style="font-size:8px;color:white;font-weight:bold;">📍</span></div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8],
        });

        L.marker([lat, lng], { icon })
          .bindPopup(`<strong>📍 ${bairro}</strong><br/><span style="color:${color};">●</span> ${lideranca.nome}${!coords ? '<br/><em style="font-size:10px;color:#999;">Localização aproximada</em>' : ''}`)
          .on('click', () => {
            focusOnLocation(lat, lng, 14, 900);
          })
          .addTo(group);
      }
      if (!cancelled) setBairroGeocoding(false);
    })();

    return () => { cancelled = true; setBairroGeocoding(false); };
  }, [selected, linkedLiderancas]);


  const queryClient = useQueryClient();

  const handleDesvincular = useCallback(async (lideranca: typeof liderancas[0]) => {
    if (!selected) return;
    try {
      const currentCidades = (lideranca.cidades_representadas as string[]) || [];
      if (lideranca.cidade_base_id === selected.id) {
        const { error } = await supabase.from("liderancas").update({ cidade_base_id: null }).eq("id", lideranca.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("liderancas").update({
          cidades_representadas: currentCidades.filter(id => id !== selected.id)
        }).eq("id", lideranca.id);
        if (error) throw error;
      }
      toast.success(`${lideranca.nome} desvinculado(a) de ${selected.nome}`);
      queryClient.invalidateQueries({ queryKey: ["liderancas"] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao desvincular");
    }
  }, [selected, queryClient]);

  // Clear highlight when deselecting
  useEffect(() => {
    if (!selectedCidadeId) {
      clearHighlight();
    }
  }, [selectedCidadeId, clearHighlight]);

  const handleLiderancaClick = useCallback((lideranca: typeof liderancas[0]) => {
    const liderancaRegion = liderancaRegionRef.current.get(lideranca.id);
    if (liderancaRegion) {
      focusOnLocation(liderancaRegion.lat, liderancaRegion.lng, 14, 900);
      return;
    }

    if (lideranca.cidade_base_id) {
      handleSelectPrioridade(lideranca.cidade_base_id);
    }
  }, [focusOnLocation, handleSelectPrioridade]);

  if (lc || lp) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-3 md:space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg md:text-2xl font-bold tracking-tight">Mapa Eleitoral</h1>
            <p className="text-xs md:text-sm text-muted-foreground">Estado de São Paulo</p>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
            {isCoord && (
              <div className="bg-muted rounded-md p-0.5 flex gap-0.5">
                <Button
                  variant={mapaMode === "minhas" ? "default" : "ghost"}
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => { setMapaMode("minhas"); setSelectedCidadeId(null); }}
                >
                  Minhas Lideranças
                </Button>
                <Button
                  variant={mapaMode === "geral" ? "default" : "ghost"}
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => { setMapaMode("geral"); setSelectedCidadeId(null); }}
                >
                  Mapa Geral
                </Button>
              </div>
            )}
            {userRole === "admin" && (
              <Button variant="outline" size="sm" onClick={() => setShareDialogOpen(true)}>
                <Share2 className="h-4 w-4 mr-1" />
                Compartilhar
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                const el = mapContainerRef.current;
                const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
                const pageW = pdf.internal.pageSize.getWidth();
                pdf.setFontSize(16);
                pdf.text("Mapa Eleitoral", pageW / 2, 14, { align: "center" });
                pdf.setFontSize(10);
                pdf.text(`${filteredCidades.length} cidades`, pageW / 2, 20, { align: "center" });
                if (el) {
                  try {
                    const canvas = await html2canvas(el, { useCORS: true, allowTaint: true, scale: 2, logging: false });
                    const img = canvas.toDataURL("image/jpeg", 0.85);
                    const maxW = pageW - 20;
                    const maxH = 160;
                    const ratio = Math.min(maxW / canvas.width, maxH / canvas.height);
                    pdf.addImage(img, "JPEG", (pageW - canvas.width * ratio) / 2, 25, canvas.width * ratio, canvas.height * ratio);
                  } catch (e) {
                    console.warn("Falha ao capturar mapa", e);
                  }
                }
                const rows = filteredCidades
                  .slice()
                  .sort((a, b) => a.nome.localeCompare(b.nome))
                  .flatMap((c) => {
                    const lids = liderancasByCidade.get(c.id) || [];
                    const dobs = (dobradinhasByCidade.get(c.id) || [])
                      .map((d: any) => d.candidato_parceiro)
                      .filter((v, i, a) => a.indexOf(v) === i)
                      .join(", ") || "—";
                    if (lids.length === 0) return [[c.nome, dobs, "—", "—"]];
                    return lids.map((l: any) => [
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
                toast.success("PDF gerado!");
              }}
            >
              <FileDown className="h-4 w-4 mr-1" />
              PDF
            </Button>
            <Badge variant="secondary" className="text-[10px] md:text-xs">{isGeralMode ? `${mapaGeral.length} cidades (geral)` : `${filteredCidades.length} cidades`}</Badge>
          </div>
        </div>
        <MapaPublicoLinksDialog open={shareDialogOpen} onOpenChange={setShareDialogOpen} />


        {/* Search */}
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar cidade..."
            value={searchCity}
            onChange={e => { setSearchCity(e.target.value); setSearchOpen(true); }}
            onFocus={() => setSearchOpen(true)}
            className="pl-9 h-9 text-sm"
          />
          {searchOpen && searchCity.length >= 2 && (
            <div className="absolute z-50 top-full mt-1 w-full bg-popover border rounded-lg shadow-lg max-h-[200px] overflow-y-auto">
              {cidades
                .filter(c => c.nome.toLowerCase().includes(searchCity.toLowerCase()))
                .slice(0, 10)
                .map(c => (
                  <button
                    key={c.id}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center justify-between"
                    onClick={() => {
                      handleSelectPrioridade(c.id);
                      setSearchCity("");
                      setSearchOpen(false);
                    }}
                  >
                    <span>{c.nome}</span>
                    <span className="text-xs text-muted-foreground">{c.regiao_administrativa}</span>
                  </button>
                ))}
              {cidades.filter(c => c.nome.toLowerCase().includes(searchCity.toLowerCase())).length === 0 && (
                <p className="px-3 py-2 text-sm text-muted-foreground">Nenhuma cidade encontrada</p>
              )}
            </div>
          )}
          {searchCity && (
            <button className="absolute right-3 top-1/2 -translate-y-1/2" onClick={() => { setSearchCity(""); setSearchOpen(false); }}>
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Filters */}
        {!isGeralMode && (
        <div className="flex flex-wrap gap-2 pb-1">
          <NativeSelect
            value={filterPrioridade}
            onChange={e => setFilterPrioridade(e.target.value)}
            className="w-[150px] md:w-[180px] h-8 text-xs"
            options={[
              { value: "todas", label: "Todas prioridades" },
              { value: "critica", label: "🔴 Crítica" },
              { value: "alta", label: "🟡 Alta" },
              { value: "media", label: "⚪ Média" },
            ]}
          />
          <NativeSelect
            value={filterCoord}
            onChange={e => setFilterCoord(e.target.value)}
            className="w-[160px] md:w-[200px] h-8 text-xs"
            options={[
              { value: "todos", label: "Todos coordenadores" },
              { value: "sem_coordenador", label: "Sem coordenador" },
              ...coordenadores.map(c => ({ value: c.user_id, label: c.nome })),
            ]}
          />
          <NativeSelect
            value={filterLideranca}
            onChange={e => setFilterLideranca(e.target.value)}
            className="w-[160px] md:w-[200px] h-8 text-xs"
            options={[
              { value: "todas", label: "Todas lideranças" },
              ...liderancas.map(l => ({ value: l.id, label: `📍 ${l.nome}` })),
            ]}
          />
          <NativeSelect
            value={filterRegiao}
            onChange={e => setFilterRegiao(e.target.value)}
            className="w-[140px] md:w-[180px] h-8 text-xs"
            options={[
              { value: "todas", label: "Todas as regiões" },
              ...regioes.map(r => ({ value: r!, label: r! })),
            ]}
          />
          <NativeSelect
            value={filterForca}
            onChange={e => setFilterForca(e.target.value)}
            className="w-[140px] md:w-[180px] h-8 text-xs"
            options={[
              { value: "todas", label: "Todas" },
              { value: "alta", label: "Alta projeção" },
              { value: "media", label: "Média projeção" },
              { value: "baixa", label: "Baixa projeção" },
              { value: "sem_projecao", label: "Sem projeção" },
            ]}
          />
          <NativeSelect
            value={filterDobradinha}
            onChange={e => setFilterDobradinha(e.target.value)}
            className="w-[140px] md:w-[180px] h-8 text-xs"
            options={[
              { value: "todas", label: "Todas" },
              { value: "com", label: "Com dobrada" },
              { value: "sem", label: "Sem dobrada" },
            ]}
          />
        </div>
        )}

      </div>

      {/* Legend + Dobrada toggle */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[10px] md:text-xs">
        <div className="flex items-center gap-2 mr-2 border rounded-md px-2 py-1 bg-muted/50">
          <Palette className="h-3.5 w-3.5 text-purple-500" />
          <Label htmlFor="colorByDob" className="text-[10px] md:text-xs cursor-pointer whitespace-nowrap">Colorir por Dobrada</Label>
          <Switch id="colorByDob" checked={colorByDobrada} onCheckedChange={setColorByDobrada} className="scale-75" />
        </div>
        {colorByDobrada ? (
          <>
            {[...dobColorMap.entries()].map(([name, color]) => (
              <div key={name} className="flex items-center gap-1">
                <div className="h-2.5 w-2.5 md:h-3 md:w-3 rounded-full shrink-0" style={{ background: color }} />
                <span className="truncate max-w-[100px]">{name}</span>
              </div>
            ))}
            <div className="flex items-center gap-1"><div className="h-2.5 w-2.5 md:h-3 md:w-3 rounded-full bg-[#d1d5db]" /> Sem dobrada</div>
          </>
        ) : (
          <>
            {coordenadores.map((c, i) => (
              <div key={c.user_id} className="flex items-center gap-1">
                <div className="h-2.5 w-2.5 md:h-3 md:w-3 rounded-full" style={{ background: coordColorMap.get(c.user_id) || COORD_COLORS[i % COORD_COLORS.length] }} />
                {c.nome.split(' ').slice(0, 2).join(' ')}
              </div>
            ))}
            <div className="flex items-center gap-1"><div className="h-2.5 w-2.5 md:h-3 md:w-3 rounded-full bg-[#60a5fa]" /> Com liderança</div>
            <div className="flex items-center gap-1"><div className="h-2.5 w-2.5 md:h-3 md:w-3 rounded-full bg-[#9ca3af]" /> Sem dados</div>
            <div className="flex items-center gap-1"><div className="h-2.5 w-2.5 md:h-3 md:w-3 rounded-full bg-[#a855f7] border-2 border-white shadow-[0_0_4px_rgba(168,85,247,0.5)]" /> Dobradinha</div>
          </>
        )}
      </div>

      {/* Map + Details + Priorities */}
      <div className={`grid gap-3 md:gap-4 ${isGeralMode ? '' : 'lg:grid-cols-[1fr_350px]'}`}>
        <Card className="overflow-hidden">
          <CardContent className="p-0 relative">
            <div ref={mapContainerRef} className="h-[350px] md:h-[500px] lg:h-[600px] w-full relative z-0" />

            {/* Map controls overlay */}
            <div className="absolute top-2 right-2 z-[400] flex flex-col gap-1.5">
              <div className="bg-background/95 backdrop-blur rounded-md shadow-md border p-1 flex gap-0.5">
                <Button
                  size="sm"
                  variant={mapLayer === "padrao" ? "default" : "ghost"}
                  className="h-7 px-2 text-xs"
                  onClick={() => setMapLayer("padrao")}
                >
                  Padrão
                </Button>
                <Button
                  size="sm"
                  variant={mapLayer === "satelite" ? "default" : "ghost"}
                  className="h-7 px-2 text-xs"
                  onClick={() => setMapLayer("satelite")}
                >
                  Satélite
                </Button>
                <Button
                  size="sm"
                  variant={mapLayer === "hibrido" ? "default" : "ghost"}
                  className="h-7 px-2 text-xs"
                  onClick={() => setMapLayer("hibrido")}
                >
                  Híbrido
                </Button>
              </div>
              <Button
                size="sm"
                variant={streetViewMode ? "default" : "secondary"}
                className="h-7 px-2 text-xs shadow-md"
                onClick={() => setStreetViewMode(v => !v)}
                title="Clique no mapa para abrir Street View"
              >
                {streetViewMode ? "✓ Street View ativo" : "🚶 Street View"}
              </Button>
            </div>

            {streetViewMode && (
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-[400] bg-background/95 backdrop-blur border rounded-md shadow-md px-3 py-2 text-xs flex flex-col items-center gap-2 max-w-[calc(100%-1rem)]">
                <span className="font-medium">
                  {streetViewPoint
                    ? `📍 ${streetViewPoint.lat.toFixed(5)}, ${streetViewPoint.lng.toFixed(5)}`
                    : "Clique em qualquer ponto do mapa para selecionar o local"}
                </span>
                {streetViewPoint && (
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${streetViewPoint.lat},${streetViewPoint.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2 py-1 rounded bg-primary text-primary-foreground hover:opacity-90 transition"
                    >
                      🗺️ Google Maps
                    </a>
                    <a
                      href={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${streetViewPoint.lat},${streetViewPoint.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2 py-1 rounded bg-secondary text-secondary-foreground hover:opacity-90 transition"
                    >
                      🚶 Street View
                    </a>
                  </div>
                )}
              </div>
            )}


          </CardContent>
        </Card>

        {!isGeralMode && (
        <div className="space-y-3 md:space-y-4">

          {filteredLiderancaInfo && (
            <Card className="border-primary/40">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-sm md:text-base">📍 {filteredLiderancaInfo.lid.nome}</CardTitle>
                  <button onClick={() => setFilterLideranca("todas")} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
                </div>
                {filteredLiderancaInfo.coordNome && (
                  <p className="text-[11px] md:text-xs text-muted-foreground">
                    Coordenador: <span className="font-medium text-foreground">{filteredLiderancaInfo.coordNome}</span>
                  </p>
                )}
              </CardHeader>
              <CardContent className="space-y-3 text-xs md:text-sm">
                <div>
                  <p className="text-[10px] md:text-xs text-muted-foreground mb-1.5">Votos por cidade (cadastrados)</p>
                  {filteredLiderancaInfo.linhas.length > 0 ? (
                    <div className="space-y-1">
                      {filteredLiderancaInfo.linhas.map(l => (
                        <div key={l.cidadeId} className="flex items-center justify-between rounded-md bg-muted px-2 py-1.5">
                          <span className="truncate">{l.cidadeNome}</span>
                          <Badge variant={l.votos > 0 ? "default" : "outline"} className="text-[10px] md:text-xs">
                            {l.votos.toLocaleString("pt-BR")} votos
                          </Badge>
                        </div>
                      ))}
                      <div className="flex items-center justify-between border-t pt-1.5 mt-1.5 font-medium">
                        <span>Soma por cidade</span>
                        <span>{filteredLiderancaInfo.somaCidades.toLocaleString("pt-BR")}</span>
                      </div>
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span>Estimativa total da liderança</span>
                        <span>{filteredLiderancaInfo.totalEstimado.toLocaleString("pt-BR")}</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-xs">Nenhuma cidade vinculada.</p>
                  )}
                </div>
                {filteredLiderancaInfo.coordId && (
                  <div className="border-t pt-2">
                    <p className="text-[10px] md:text-xs text-muted-foreground">Total do coordenador</p>
                    <p className="text-lg font-bold text-primary">
                      {filteredLiderancaInfo.totalCoordenador.toLocaleString("pt-BR")}
                      <span className="text-xs font-normal text-muted-foreground"> votos · {filteredLiderancaInfo.qtdLiderancasCoord} liderança(s)</span>
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
          {selected ? (
            <Card>
              <CardHeader className="pb-2 md:pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm md:text-base">{selected.nome}</CardTitle>
                  <button onClick={() => setSelectedCidadeId(null)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
                </div>
                {selectedPrio && (selectedPrio.nivel === 'critica' || selectedPrio.nivel === 'alta') && (
                  <div className={`rounded-md px-2 py-1 text-[10px] md:text-xs flex items-center gap-1 ${
                    selectedPrio.nivel === 'critica' ? 'bg-destructive/10 text-destructive' : 'bg-warning/10 text-warning-foreground'
                  }`}>
                    ⚠ Prioridade {selectedPrio.nivel}: {selectedPrio.motivos.join(' · ')}
                    {selectedPrio.gap > 0 && <span className="font-medium ml-1">| Gap: {selectedPrio.gap.toLocaleString('pt-BR')} votos</span>}
                  </div>
                )}
              </CardHeader>
              <CardContent className="space-y-3 md:space-y-4 text-xs md:text-sm">
                <div className="grid grid-cols-2 gap-2 md:gap-3">
                  <div><p className="text-[10px] md:text-xs text-muted-foreground">População</p><p className="font-medium">{(selected.populacao || 0).toLocaleString('pt-BR')}</p></div>
                  <div><p className="text-[10px] md:text-xs text-muted-foreground">Eleitores</p><p className="font-medium">{(selected.eleitores || 0).toLocaleString('pt-BR')}</p></div>
                  <div><p className="text-[10px] md:text-xs text-muted-foreground">PIB Municipal</p><p className="font-medium">R$ {(selected.pib_municipal || 0).toLocaleString('pt-BR')}M</p></div>
                  <div><p className="text-[10px] md:text-xs text-muted-foreground">Região</p><p className="font-medium">{selected.regiao_administrativa}</p></div>
                </div>

                {/* Atalhos para Google Maps */}
                <div className="flex flex-wrap gap-1.5 border-t pt-2 md:pt-3">
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selected.nome + ', SP, Brasil')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2 py-1 text-[10px] md:text-xs rounded bg-primary text-primary-foreground hover:opacity-90 transition"
                  >
                    🗺️ Google Maps
                  </a>
                  {selected.latitude && selected.longitude && (
                    <a
                      href={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${selected.latitude},${selected.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2 py-1 text-[10px] md:text-xs rounded bg-secondary text-secondary-foreground hover:opacity-90 transition"
                    >
                      🚶 Street View
                    </a>
                  )}
                </div>

                {selectedVotosTse && (
                  <div className="border-t pt-2 md:pt-3">
                    <p className="text-[10px] md:text-xs text-muted-foreground mb-1">
                      Votos {CANDIDATO_REFERENCIA} · {ANO_REFERENCIA}
                    </p>
                    <p className="text-lg font-bold text-primary">
                      {selectedVotosTse.total.toLocaleString('pt-BR')}{' '}
                      <span className="text-xs font-normal text-muted-foreground">votos</span>
                    </p>
                    {selectedVotosTse.zonas.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {selectedVotosTse.zonas.slice(0, 8).map(z => (
                          <Badge key={z.zona} variant="outline" className="text-[10px]">
                            Zona {z.zona}: {z.votos.toLocaleString('pt-BR')}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {selectedEstVotos > 0 && (
                  <div className="border-t pt-2 md:pt-3">
                    <p className="text-[10px] md:text-xs text-muted-foreground mb-1">Estimativa via Líderes</p>
                    <p className="text-lg font-bold text-primary">{selectedEstVotos.toLocaleString('pt-BR')} <span className="text-xs font-normal text-muted-foreground">votos estimados</span></p>
                  </div>
                )}


                {linkedCoordenadores.length > 0 && (
                  <div className="border-t pt-2 md:pt-3">
                    <p className="text-[10px] md:text-xs text-muted-foreground mb-1.5">Coordenadores ({linkedCoordenadores.length})</p>
                    <div className="flex flex-wrap gap-1.5">
                      {linkedCoordenadores.map(c => (
                        <Badge key={c.user_id} variant="secondary" className="text-[10px] gap-1">
                          <span className="inline-block w-2 h-2 rounded-full" style={{ background: c.cor || '#888' }} />
                          {c.nome}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {linkedLiderancas.length > 0 && (
                  <div className="border-t pt-2 md:pt-3">
                    <div className="flex items-center justify-between mb-1.5 md:mb-2">
                      <p className="text-[10px] md:text-xs text-muted-foreground">Líderes Vinculados ({linkedLiderancas.length})</p>
                      {bairroGeocoding && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Loader2 className="h-3 w-3 animate-spin" /> Localizando bairros...
                        </span>
                      )}
                    </div>
                    <div className="space-y-1.5 md:space-y-2">
                      {linkedLiderancas.map((l, lIdx) => {
                        const coordColor = l.coordenador_user_id ? coordColorMap.get(l.coordenador_user_id) : undefined;
                        const coordNome = l.coordenador_user_id ? coordNameMap.get(l.coordenador_user_id) : undefined;
                        const lidColor = LIDERANCA_COLORS[lIdx % LIDERANCA_COLORS.length];
                        return (
                          <div key={l.id} className="rounded-lg bg-muted p-1.5 md:p-2 flex items-center justify-between gap-2 cursor-pointer hover:bg-muted/80 transition-colors" onClick={() => handleLiderancaClick(l)}>
                            <div className="min-w-0">
                              <p className="font-medium text-xs md:text-sm truncate flex items-center gap-1.5">
                                <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ background: lidColor }} />
                                {l.nome}
                              </p>
                              {(l as any).bairros?.length > 0 && (
                                <p className="text-[10px] text-muted-foreground ml-4">
                                  📍 {((l as any).bairros as string[]).join(', ')}
                                </p>
                              )}
                              <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                                <Badge variant={l.forca_politica === 'alta' ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0">{l.forca_politica}</Badge>
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">{l.status}</Badge>
                                {l.cidade_base_id === selected!.id && <span className="text-[10px] text-primary font-medium">base</span>}
                                {l.votos_estimados ? <span className="text-[10px] font-medium">{l.votos_estimados.toLocaleString('pt-BR')} votos</span> : null}
                                {coordNome && (
                                  <span className="text-[10px] flex items-center gap-0.5">
                                    <span className="inline-block w-2 h-2 rounded-full" style={{ background: coordColor }} />
                                    {coordNome.split(' ')[0]}
                                  </span>
                                )}
                              </div>
                            </div>
                            <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => handleDesvincular(l)} title="Desvincular">
                              <Unlink className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {linkedCabos.length > 0 && (
                  <div className="border-t pt-2 md:pt-3">
                    <p className="text-[10px] md:text-xs text-muted-foreground mb-1.5">Cabos Eleitorais ({linkedCabos.length})</p>
                    <div className="space-y-1">
                      {linkedCabos.map(c => {
                        const lider = liderancaMap.get(c.lider_id);
                        return (
                          <div key={c.id} className="rounded-md bg-muted/60 px-2 py-1 flex items-center justify-between text-[11px]">
                            <div className="min-w-0">
                              <p className="font-medium truncate">{c.nome}</p>
                              <p className="text-[10px] text-muted-foreground truncate">
                                Líder: {lider?.nome || '—'}{c.bairro ? ` • ${c.bairro}` : ''}
                              </p>
                            </div>
                            {c.votos_estimados ? <span className="text-[10px] font-medium shrink-0">{c.votos_estimados.toLocaleString('pt-BR')} votos</span> : null}
                          </div>
                        );
                      })}
                      <p className="text-[10px] font-medium text-right pt-1">
                        Total: {linkedCabos.reduce((s, c) => s + (c.votos_estimados || 0), 0).toLocaleString('pt-BR')} votos
                      </p>
                    </div>
                  </div>
                )}
                {selectedProj && (
                  <div className="border-t pt-2 md:pt-3">
                    <p className="text-[10px] md:text-xs text-muted-foreground mb-1.5 md:mb-2">Projeção de Votos</p>
                    <div className="grid grid-cols-3 gap-1.5 md:gap-2">
                      <div className="text-center rounded-lg bg-muted p-1.5 md:p-2"><p className="text-base md:text-lg font-bold">{((selectedProj.votos_projetados || 0) / 1000).toFixed(0)}k</p><p className="text-[9px] md:text-[10px] text-muted-foreground">Projetados</p></div>
                      <div className="text-center rounded-lg bg-muted p-1.5 md:p-2"><p className="text-base md:text-lg font-bold">{((selectedProj.votos_confirmados || 0) / 1000).toFixed(0)}k</p><p className="text-[9px] md:text-[10px] text-muted-foreground">Confirmados</p></div>
                      <div className="text-center rounded-lg bg-muted p-1.5 md:p-2"><p className="text-base md:text-lg font-bold">{((selectedProj.meta_votos || 0) / 1000).toFixed(0)}k</p><p className="text-[9px] md:text-[10px] text-muted-foreground">Meta</p></div>
                    </div>
                  </div>
                )}
                {selectedEstrutura && (
                  <div className="border-t pt-2 md:pt-3">
                    <p className="text-[10px] md:text-xs text-muted-foreground mb-1.5 md:mb-2">Estrutura de Campanha</p>
                    <div className="grid grid-cols-2 gap-1.5 md:gap-2 text-[11px] md:text-xs">
                      <div><span className="text-muted-foreground">Cabos eleitorais:</span> {selectedEstrutura.cabos_eleitorais}</div>
                      <div><span className="text-muted-foreground">Apoiadores:</span> {(selectedEstrutura.apoiadores || 0).toLocaleString('pt-BR')}</div>
                      <div><span className="text-muted-foreground">Veículos:</span> {selectedEstrutura.veiculos}</div>
                      <div><span className="text-muted-foreground">Materiais:</span> {(selectedEstrutura.materiais_distribuidos || 0).toLocaleString('pt-BR')}</div>
                    </div>
                  </div>
                )}
                {selectedDobradinhas.length > 0 && (
                  <div className="border-t pt-2 md:pt-3">
                    <p className="text-[10px] md:text-xs text-muted-foreground mb-1.5 md:mb-2">Dobrada</p>
                    <div className="space-y-1.5 md:space-y-2">
                      {selectedDobradinhas.map(d => (
                        <div key={d.id} className="rounded-lg bg-muted p-1.5 md:p-2">
                          <div className="flex items-center justify-between">
                            <p className="font-medium text-xs md:text-sm">{d.candidato_parceiro}</p>
                            <Badge variant="default" className="text-[10px] md:text-xs">{(d.votos_estimados || 0).toLocaleString('pt-BR')} votos</Badge>
                          </div>
                          {d.cargo_parceiro && <p className="text-[10px] md:text-xs text-muted-foreground">{d.cargo_parceiro}</p>}
                          {d.lideranca_id && liderancaMap.get(d.lideranca_id) && (
                            <p className="text-[10px] md:text-xs text-muted-foreground">Líder: {liderancaMap.get(d.lideranca_id)!.nome}</p>
                          )}
                        </div>
                      ))}
                      <p className="text-[10px] md:text-xs font-medium text-right">Total: {selectedDobradinhas.reduce((s, d) => s + (d.votos_estimados || 0), 0).toLocaleString('pt-BR')} votos</p>
                    </div>
                  </div>
                )}
                <div className="border-t pt-2 md:pt-3 grid grid-cols-2 gap-1.5 md:flex md:flex-wrap md:gap-2">
                  <AssociarLiderancaDialog cidadeId={selected.id} cidadeNome={selected.nome} trigger={<Button size="sm" variant="outline" className="w-full text-[10px] md:text-xs h-8"><UserPlus className="h-3 w-3 md:h-3.5 md:w-3.5 mr-1" />Vincular</Button>} />
                  <LiderancaFormDialog trigger={<Button size="sm" variant="outline" className="w-full text-[10px] md:text-xs h-8"><Plus className="h-3 w-3 md:h-3.5 md:w-3.5 mr-1" />Líder</Button>} />
                  <CaboEleitoralFormDialog trigger={<Button size="sm" variant="outline" className="w-full text-[10px] md:text-xs h-8"><Plus className="h-3 w-3 md:h-3.5 md:w-3.5 mr-1" />Cabo</Button>} />
                  <ProjecaoFormDialog defaultCidadeId={selected.id} trigger={<Button size="sm" variant="outline" className="w-full text-[10px] md:text-xs h-8"><Plus className="h-3 w-3 md:h-3.5 md:w-3.5 mr-1" />Projeção</Button>} />
                  <DobradinhaFormDialog defaultCidadeId={selected.id} trigger={<Button size="sm" variant="outline" className="w-full text-[10px] md:text-xs h-8"><Plus className="h-3 w-3 md:h-3.5 md:w-3.5 mr-1" />Dobrada</Button>} />
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card><CardContent className="p-4 md:p-6 text-center text-xs md:text-sm text-muted-foreground"><p>Clique em uma cidade no mapa para ver seus detalhes</p></CardContent></Card>
          )}

          {/* Painel de Prioridades */}
          <PainelPrioridades
            prioridades={prioridades}
            onSelectCidade={handleSelectPrioridade}
          />
        </div>
        )}

      </div>
    </div>
  );
}
