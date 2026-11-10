import { useMemo, useState } from "react";
import { PageHeader } from "@/components/logistics/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useCidades } from "@/hooks/useSupabaseData";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, MapPin, Route as RouteIcon, Search, ExternalLink, RotateCcw, Pencil, FileDown, Plus, Trash2 } from "lucide-react";
import { ITENS_MATERIAL, zeroQuantidades, useMaterialPlanejamento, type Quantidades } from "@/lib/materiaisCampanha";
import { toast } from "sonner";

const CD_PADRAO = "Rua Bom Pastor, 2224 - Ipiranga, São Paulo - SP";
const CD_LAT = -23.5966;
const CD_LNG = -46.6045;

type Ponto = {
  id: string;
  cidadeId: string;
  cidadeNome: string;
  nome: string;
  lat: number;
  lng: number;
  endereco: string | null;
  contato: string | null;
  telefone: string | null;
};

function distanciaKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Vizinho mais próximo + melhoria 2-opt (rota curta, sem depender de API externa). */
function melhorOrdem(origem: { lat: number; lng: number }, pontos: Ponto[], voltar: boolean) {
  const restantes = [...pontos];
  const ordem: Ponto[] = [];
  let atual: { lat: number; lng: number } = origem;
  while (restantes.length) {
    let melhor = 0;
    let melhorD = Infinity;
    restantes.forEach((p, i) => {
      const d = distanciaKm(atual, p);
      if (d < melhorD) { melhorD = d; melhor = i; }
    });
    const escolhido = restantes.splice(melhor, 1)[0];
    ordem.push(escolhido);
    atual = escolhido;
  }

  const total = (seq: Ponto[]) => {
    let soma = 0;
    let ant: { lat: number; lng: number } = origem;
    for (const p of seq) { soma += distanciaKm(ant, p); ant = p; }
    if (voltar && seq.length) soma += distanciaKm(ant, origem);
    return soma;
  };

  let melhorou = true;
  let guard = 0;
  while (melhorou && guard < 60) {
    melhorou = false;
    guard++;
    for (let i = 0; i < ordem.length - 1; i++) {
      for (let j = i + 1; j < ordem.length; j++) {
        const novo = [...ordem.slice(0, i), ...ordem.slice(i, j + 1).reverse(), ...ordem.slice(j + 1)];
        if (total(novo) + 0.0001 < total(ordem)) {
          ordem.splice(0, ordem.length, ...novo);
          melhorou = true;
        }
      }
    }
  }
  return ordem;
}

function useRepresentantes() {
  return useQuery({
    queryKey: ["cidades-representantes-itinerario"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_cidades_representantes");
      if (error) throw error;
      return (data || []) as any[];
    },
  });
}

function usePontosEntrega() {
  return useQuery({
    queryKey: ["pontos-entrega"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pontos_entrega")
        .select("*")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return (data || []) as any[];
    },
  });
}

/** Materiais por cidade vindos do Planejamento de Material de Campanha. */
function useCargaPorCidade() {
  const { quantidadesPorCidade } = useMaterialPlanejamento();
  return quantidadesPorCidade;
}


const fmt = (n: number) => n.toLocaleString("pt-BR");

export default function LogItinerario() {
  const { data: cidades = [], isLoading } = useCidades();
  const { data: representantes = [], isLoading: lr } = useRepresentantes();
  const { data: pontos = [], isLoading: lp } = usePontosEntrega();
  const cargaMap = useCargaPorCidade();
  const queryClient = useQueryClient();

  const [origem, setOrigem] = useState(CD_PADRAO);
  const [origemCoord, setOrigemCoord] = useState({ lat: CD_LAT, lng: CD_LNG });
  const [busca, setBusca] = useState("");
  const [selecionadas, setSelecionadas] = useState<string[]>([]);
  const [voltar, setVoltar] = useState(true);
  const [resultado, setResultado] = useState<Ponto[] | null>(null);
  const [calculando, setCalculando] = useState(false);
  const [gerenciando, setGerenciando] = useState<any | null>(null);

  const repMap = useMemo(() => {
    const m = new Map<string, any>();
    representantes.forEach(r => {
      if (r.tem_coordenador || r.tem_lider || r.tem_cabo) m.set(r.cidade_id, r);
    });
    return m;
  }, [representantes]);

  // Cidades marcadas no mapa (com representante) e com localização cadastrada
  const cidadesAlvo = useMemo(
    () => cidades.filter((c: any) => repMap.has(c.id) && c.latitude != null && c.longitude != null),
    [cidades, repMap]
  );

  const pontosPorCidade = useMemo(() => {
    const m = new Map<string, any[]>();
    pontos.forEach(p => {
      if (!p.cidade_id) return;
      m.set(p.cidade_id, [...(m.get(p.cidade_id) || []), p]);
    });
    return m;
  }, [pontos]);

  /** Cada parada = um ponto de entrega (um por coordenador). Cidade sem ponto usa o endereço legado. */
  const paradas: Ponto[] = useMemo(() => {
    const out: Ponto[] = [];
    cidadesAlvo.forEach((c: any) => {
      const lista = pontosPorCidade.get(c.id) || [];
      if (lista.length) {
        lista.forEach((p: any) =>
          out.push({
            id: p.id,
            cidadeId: c.id,
            cidadeNome: c.nome,
            nome: p.nome,
            lat: Number(p.latitude ?? c.latitude),
            lng: Number(p.longitude ?? c.longitude),
            endereco: [p.endereco, p.bairro].filter(Boolean).join(", ") || null,
            contato: p.responsavel_nome || null,
            telefone: p.responsavel_telefone || null,
          })
        );
      } else {
        out.push({
          id: `cidade:${c.id}`,
          cidadeId: c.id,
          cidadeNome: c.nome,
          nome: c.nome,
          lat: Number(c.latitude),
          lng: Number(c.longitude),
          endereco: c.endereco_entrega || null,
          contato: c.entrega_contato_nome || null,
          telefone: c.entrega_contato_telefone || null,
        });
      }
    });
    return out;
  }, [cidadesAlvo, pontosPorCidade]);

  const listaFiltrada = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return paradas;
    return paradas.filter(p => `${p.cidadeNome} ${p.nome} ${p.endereco || ""}`.toLowerCase().includes(q));
  }, [paradas, busca]);

  const semEndereco = useMemo(() => paradas.filter(p => !p.endereco).length, [paradas]);

  const toggle = (id: string) =>
    setSelecionadas(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));

  function rotuloRepresentante(cidadeId: string) {
    const r = repMap.get(cidadeId);
    if (!r) return "";
    const nomes: string[] = r.coordenador_nomes || [];
    if (nomes.length) return nomes.join(", ");
    if (r.lider_count > 0) return `${r.lider_count} liderança(s)`;
    if (r.cabo_count > 0) return `${r.cabo_count} cabo(s)`;
    return "Representado";
  }

  /** Carga da cidade dividida entre as paradas selecionadas daquela cidade. */
  const cargaDaParada = useMemo(() => {
    const alvo = resultado || paradas.filter(p => selecionadas.includes(p.id));
    const contagem = new Map<string, number>();
    alvo.forEach(p => contagem.set(p.cidadeId, (contagem.get(p.cidadeId) || 0) + 1));
    const out = new Map<string, Quantidades>();
    alvo.forEach(p => {
      const g = cargaMap.get(p.cidadeId);
      const n = contagem.get(p.cidadeId) || 1;
      const q = zeroQuantidades();
      ITENS_MATERIAL.forEach(i => { q[i.key] = Math.round((g?.[i.key] || 0) / n); });
      out.set(p.id, q);
    });
    return out;
  }, [resultado, paradas, selecionadas, cargaMap]);


  async function calcular() {
    const escolhidos = paradas.filter(p => selecionadas.includes(p.id));
    if (escolhidos.length < 1) { toast.error("Selecione pelo menos um ponto de entrega."); return; }

    setCalculando(true);
    let coord = { lat: CD_LAT, lng: CD_LNG };
    if (origem.trim() && origem.trim() !== CD_PADRAO) {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(origem)}`
        );
        const json = await res.json();
        if (json?.[0]) coord = { lat: Number(json[0].lat), lng: Number(json[0].lon) };
        else toast.warning("Endereço de origem não localizado — usando São Paulo capital.");
      } catch {
        toast.warning("Não foi possível localizar o endereço — usando São Paulo capital.");
      }
    }
    setOrigemCoord(coord);
    setResultado(melhorOrdem(coord, escolhidos, voltar));
    setCalculando(false);
  }

  const trechos = useMemo(() => {
    if (!resultado) return [];
    let ant: { lat: number; lng: number } = origemCoord;
    let acumulado = 0;
    return resultado.map(p => {
      const d = distanciaKm(ant, p);
      acumulado += d;
      ant = p;
      return { ponto: p, km: d, acumulado };
    });
  }, [resultado, origemCoord]);

  const totalKm = useMemo(() => {
    if (!trechos.length) return 0;
    const ultimo = trechos[trechos.length - 1];
    return ultimo.acumulado + (voltar ? distanciaKm(ultimo.ponto, origemCoord) : 0);
  }, [trechos, voltar, origemCoord]);

  const totalCarga = useMemo(() => {
    const base = zeroQuantidades();
    (resultado || []).forEach(p => {
      const g = cargaDaParada.get(p.id);
      if (!g) return;
      ITENS_MATERIAL.forEach(i => { base[i.key] += g[i.key]; });
    });
    return base;
  }, [resultado, cargaDaParada]);

  function exportarRomaneio() {
    if (!resultado?.length) return;
    const BOM = "\uFEFF";
    const header = ["Ordem", "Cidade", "Ponto / Coordenador", "Representantes", "Endereço de entrega", "Contato", ...ITENS_MATERIAL.map(i => i.label), "Trecho (km)"].join(";");
    const linhas = trechos.map((t, i) => {
      const g = cargaDaParada.get(t.ponto.id);
      return [
        i + 1,
        t.ponto.cidadeNome,
        t.ponto.nome,
        rotuloRepresentante(t.ponto.cidadeId),
        t.ponto.endereco || "",
        [t.ponto.contato, t.ponto.telefone].filter(Boolean).join(" "),
        ...ITENS_MATERIAL.map(it => g?.[it.key] || 0),
        t.km.toFixed(0),
      ].join(";");
    });
    const totalLinha = ["", "TOTAL", "", "", "", "", ...ITENS_MATERIAL.map(i => totalCarga[i.key]), totalKm.toFixed(0)].join(";");

    const csv = BOM + [header, ...linhas, totalLinha].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `romaneio-itinerario-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const mapsUrl = useMemo(() => {
    if (!resultado?.length) return "";
    const alvo = (p: Ponto) => encodeURIComponent(p.endereco ? p.endereco : `${p.cidadeNome}, SP`);
    const o = encodeURIComponent(origem || CD_PADRAO);
    const destino = voltar ? o : alvo(resultado[resultado.length - 1]);
    const paradasUrl = (voltar ? resultado : resultado.slice(0, -1)).map(alvo).join("|");
    return `https://www.google.com/maps/dir/?api=1&origin=${o}&destination=${destino}${paradasUrl ? `&waypoints=${paradasUrl}` : ""}&travelmode=driving`;
  }, [resultado, origem, voltar]);

  return (
    <div className="space-y-4 sm:space-y-6 max-w-6xl">
      <PageHeader title="Melhor Itinerário" description="Ordem sugerida de entrega saindo do Centro de Distribuição" />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><RouteIcon className="h-4 w-4" /> Configuração da rota</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Saída (Centro de Distribuição)</Label>
            <Input value={origem} onChange={e => setOrigem(e.target.value)} placeholder={CD_PADRAO} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <Label>Pontos de entrega por coordenador</Label>
              {semEndereco > 0 && (
                <span className="text-xs text-amber-600">{semEndereco} ponto(s) ainda sem endereço exato</span>
              )}
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar cidade, coordenador ou endereço..." value={busca} onChange={e => setBusca(e.target.value)} className="pl-9" />
            </div>
            {isLoading || lr || lp ? (
              <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
            ) : (
              <div className="max-h-96 overflow-y-auto border border-border rounded-lg divide-y divide-border">
                {listaFiltrada.map(p => {
                  const cidade = cidadesAlvo.find((c: any) => c.id === p.cidadeId);
                  const qtdPontos = (pontosPorCidade.get(p.cidadeId) || []).length;
                  return (
                    <div key={p.id} className="flex items-start gap-3 px-3 py-2">
                      <Checkbox className="mt-1" checked={selecionadas.includes(p.id)} onCheckedChange={() => toggle(p.id)} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate flex items-center gap-2">
                          {p.cidadeNome}
                          {qtdPontos > 1 && <Badge variant="secondary" className="text-[10px]">{qtdPontos} pontos</Badge>}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {p.nome !== p.cidadeNome ? p.nome : rotuloRepresentante(p.cidadeId)}
                        </p>
                        <p className={`text-xs truncate ${p.endereco ? "text-muted-foreground" : "text-amber-600"}`}>
                          {p.endereco || "Sem endereço exato de entrega"}
                          {p.contato ? ` • ${p.contato}` : ""}
                        </p>
                      </div>
                      <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => setGerenciando(cidade)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  );
                })}
                {listaFiltrada.length === 0 && (
                  <p className="text-sm text-muted-foreground p-3">Nenhum ponto de entrega encontrado.</p>
                )}
              </div>
            )}
            <p className="text-xs text-muted-foreground">{selecionadas.length} ponto(s) selecionado(s)</p>
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={voltar} onCheckedChange={v => setVoltar(!!v)} />
            Retornar ao Centro de Distribuição no fim do trajeto
          </label>

          <div className="flex gap-2 flex-wrap">
            <Button onClick={calcular} disabled={calculando}>
              {calculando ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Calculando...</> : <><RouteIcon className="h-4 w-4 mr-2" /> Calcular melhor itinerário</>}
            </Button>
            {paradas.length > 0 && (
              <Button variant="outline" onClick={() => setSelecionadas(listaFiltrada.map(p => p.id))}>
                Selecionar todos
              </Button>
            )}
            {selecionadas.length > 0 && (
              <Button variant="outline" onClick={() => { setSelecionadas([]); setResultado(null); }}>
                <RotateCcw className="h-4 w-4 mr-2" /> Limpar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {resultado && (
        <Card>
          <CardHeader className="pb-3 flex-row items-center justify-between gap-2 space-y-0 flex-wrap">
            <CardTitle className="text-base">
              Itinerário sugerido — {resultado.length} paradas • {totalKm.toFixed(0)} km aprox.
            </CardTitle>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={exportarRomaneio}>
                <FileDown className="h-4 w-4 mr-2" /> Romaneio (CSV)
              </Button>
              <Button asChild size="sm" variant="outline">
                <a href={mapsUrl} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4 mr-2" /> Abrir no Google Maps</a>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Parada</TableHead>
                    {ITENS_MATERIAL.map(i => (
                      <TableHead key={i.key} className="text-right whitespace-nowrap">{i.short}</TableHead>
                    ))}
                    <TableHead className="text-right">Trecho (km)</TableHead>
                    <TableHead className="text-right">Acumulado (km)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow className="bg-muted/40">
                    <TableCell>—</TableCell>
                    <TableCell className="font-medium flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-primary" /> Saída: {origem}</TableCell>
                    {ITENS_MATERIAL.map(i => (
                      <TableCell key={i.key} className="text-right">{fmt(totalCarga[i.key])}</TableCell>
                    ))}
                    <TableCell className="text-right">0</TableCell>
                    <TableCell className="text-right">0</TableCell>
                  </TableRow>
                  {trechos.map((t, i) => {
                    const g = cargaDaParada.get(t.ponto.id);
                    return (
                      <TableRow key={t.ponto.id}>
                        <TableCell className="font-semibold">{i + 1}</TableCell>
                        <TableCell>
                          <p className="font-medium">{t.ponto.cidadeNome}</p>
                          <p className="text-xs text-muted-foreground">{t.ponto.nome}</p>
                          <p className="text-xs text-muted-foreground">{t.ponto.endereco || "Sem endereço exato"}</p>
                        </TableCell>
                        {ITENS_MATERIAL.map(it => (
                          <TableCell key={it.key} className="text-right">{fmt(g?.[it.key] || 0)}</TableCell>
                        ))}
                        <TableCell className="text-right">{t.km.toFixed(0)}</TableCell>
                        <TableCell className="text-right">{t.acumulado.toFixed(0)}</TableCell>
                      </TableRow>
                    );
                  })}
                  {voltar && trechos.length > 0 && (
                    <TableRow className="bg-muted/40">
                      <TableCell>—</TableCell>
                      <TableCell className="font-medium">Retorno ao CD</TableCell>
                      {ITENS_MATERIAL.map(i => (
                        <TableCell key={i.key} className="text-right">—</TableCell>
                      ))}
                      <TableCell className="text-right">{distanciaKm(trechos[trechos.length - 1].ponto, origemCoord).toFixed(0)}</TableCell>
                      <TableCell className="text-right">{totalKm.toFixed(0)}</TableCell>
                    </TableRow>
                  )}

                </TableBody>
              </Table>
            </div>

            <p className="text-xs text-muted-foreground p-4">
              Distâncias em linha reta, usadas apenas para definir a melhor sequência de visitas. Quando a cidade tem mais de um ponto, a carga é dividida entre os pontos selecionados.
            </p>
          </CardContent>
        </Card>
      )}

      <PontosEntregaDialog
        cidade={gerenciando}
        pontos={gerenciando ? (pontosPorCidade.get(gerenciando.id) || []) : []}
        coordenadores={gerenciando ? repMap.get(gerenciando.id) : null}
        onClose={() => setGerenciando(null)}
        onSaved={() => setTimeout(() => queryClient.invalidateQueries({ queryKey: ["pontos-entrega"] }), 150)}
      />
    </div>
  );
}

function PontosEntregaDialog({
  cidade, pontos, coordenadores, onClose, onSaved,
}: {
  cidade: any | null;
  pontos: any[];
  coordenadores: any | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [editando, setEditando] = useState<any | null>(null);

  const coordOptions: { id: string; nome: string }[] = useMemo(() => {
    const ids: string[] = coordenadores?.coordenador_ids || [];
    const nomes: string[] = coordenadores?.coordenador_nomes || [];
    return ids.map((id, i) => ({ id, nome: nomes[i] || "Coordenador" }));
  }, [coordenadores]);

  async function excluir(p: any) {
    const { error } = await supabase.from("pontos_entrega").delete().eq("id", p.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Ponto removido.");
    onSaved();
  }

  return (
    <Dialog open={!!cidade} onOpenChange={o => { if (!o) { setEditando(null); onClose(); } }}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Pontos de entrega – {cidade?.nome}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-3">
          {!editando && (
            <>
              {pontos.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Nenhum ponto cadastrado. Cidades com vários coordenadores podem ter um endereço para cada um.
                </p>
              )}
              {pontos.map(p => (
                <div key={p.id} className="border border-border rounded-lg p-3 flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.nome}</p>
                    <p className="text-xs text-muted-foreground">{[p.endereco, p.bairro].filter(Boolean).join(", ")}</p>
                    {p.responsavel_nome && (
                      <p className="text-xs text-muted-foreground">{p.responsavel_nome} {p.responsavel_telefone || ""}</p>
                    )}
                  </div>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditando(p)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => excluir(p)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" className="w-full" onClick={() => setEditando({})}>
                <Plus className="h-4 w-4 mr-2" /> Novo ponto de entrega
              </Button>
            </>
          )}

          {editando && (
            <PontoForm
              cidade={cidade}
              ponto={editando}
              coordOptions={coordOptions}
              onCancel={() => setEditando(null)}
              onSaved={() => { setEditando(null); onSaved(); }}
            />
          )}
        </div>

        {!editando && (
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Fechar</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PontoForm({
  cidade, ponto, coordOptions, onCancel, onSaved,
}: {
  cidade: any;
  ponto: any;
  coordOptions: { id: string; nome: string }[];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [nome, setNome] = useState(ponto.nome || "");
  const [coord, setCoord] = useState(ponto.coordenador_user_id || "");
  const [endereco, setEndereco] = useState(ponto.endereco || "");
  const [bairro, setBairro] = useState(ponto.bairro || "");
  const [responsavel, setResponsavel] = useState(ponto.responsavel_nome || "");
  const [telefone, setTelefone] = useState(ponto.responsavel_telefone || "");
  const [saving, setSaving] = useState(false);

  async function salvar() {
    if (!endereco.trim()) { toast.error("Informe o endereço de entrega."); return; }
    setSaving(true);

    // Geocodifica o endereço; se falhar, usa o centro da cidade.
    let lat = ponto.latitude ?? cidade.latitude;
    let lng = ponto.longitude ?? cidade.longitude;
    try {
      const q = `${endereco}, ${bairro ? bairro + ", " : ""}${cidade.nome}, SP, Brasil`;
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(q)}`);
      const json = await res.json();
      if (json?.[0]) { lat = Number(json[0].lat); lng = Number(json[0].lon); }
    } catch { /* mantém o centro da cidade */ }

    const payload: any = {
      nome: nome.trim() || coordOptions.find(c => c.id === coord)?.nome || cidade.nome,
      cidade_id: cidade.id,
      coordenador_user_id: coord || null,
      endereco: endereco.trim(),
      bairro: bairro.trim() || null,
      responsavel_nome: responsavel.trim() || null,
      responsavel_telefone: telefone.trim() || null,
      latitude: lat != null ? Number(lat) : null,
      longitude: lng != null ? Number(lng) : null,
      ativo: true,
    };

    const { error } = ponto.id
      ? await supabase.from("pontos_entrega").update(payload).eq("id", ponto.id)
      : await supabase.from("pontos_entrega").insert(payload);

    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Ponto de entrega salvo!");
    onSaved();
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>Coordenador responsável</Label>
        <NativeSelect
          value={coord}
          options={[{ value: "", label: "Sem coordenador vinculado" }, ...coordOptions.map(c => ({ value: c.id, label: c.nome }))]}
          onChange={e => {
            setCoord(e.target.value);
            const n = coordOptions.find(c => c.id === e.target.value)?.nome;
            if (n && !nome) setNome(n);
          }}
        />
      </div>
      <div className="space-y-2">
        <Label>Identificação do ponto</Label>
        <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: Coordenação Zona Leste" maxLength={100} />
      </div>
      <div className="space-y-2">
        <Label>Endereço exato *</Label>
        <Input value={endereco} onChange={e => setEndereco(e.target.value)} placeholder="Rua, número" maxLength={200} />
      </div>
      <div className="space-y-2">
        <Label>Bairro</Label>
        <Input value={bairro} onChange={e => setBairro(e.target.value)} maxLength={100} />
      </div>
      <div className="space-y-2">
        <Label>Quem recebe</Label>
        <Input value={responsavel} onChange={e => setResponsavel(e.target.value)} maxLength={100} />
      </div>
      <div className="space-y-2">
        <Label>Telefone</Label>
        <Input value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(00) 00000-0000" maxLength={20} />
      </div>
      <div className="flex gap-2 justify-end pt-2">
        <Button variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button onClick={salvar} disabled={saving}>{saving ? "Salvando..." : "Salvar ponto"}</Button>
      </div>
    </div>
  );
}
