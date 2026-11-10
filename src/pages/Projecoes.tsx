import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProjecoes, useCidades, useLiderancas } from "@/hooks/useSupabaseData";
import { useCoordenadores } from "@/hooks/useCoordenadores";
import { NativeSelect } from "@/components/ui/native-select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Loader2, Users, UserCog, BarChart2, Search } from "lucide-react";
import ProjecaoFormDialog from "@/components/ProjecaoFormDialog";


export default function Projecoes() {
  const { data: projecoes = [], isLoading: lp } = useProjecoes();
  const { data: cidades = [], isLoading: lc } = useCidades();
  const { data: liderancas = [], isLoading: ll } = useLiderancas();
  const { data: coordenadores = [] } = useCoordenadores();
  const [coordFilter, setCoordFilter] = useState("todos");
  const [search, setSearch] = useState("");


  const cidadeMap = useMemo(() => new Map(cidades.map(c => [c.id, c])), [cidades]);
  const liderancaMap = useMemo(() => new Map(liderancas.map(l => [l.id, l])), [liderancas]);
  const coordMap = useMemo(() => new Map(coordenadores.map(c => [c.user_id, c])), [coordenadores]);

  // Filter liderancas by selected coordenador
  const filteredLiderancas = useMemo(() => {
    if (coordFilter === "todos") return liderancas;
    if (coordFilter === "sem_coordenador") return liderancas.filter(l => !l.coordenador_user_id);
    return liderancas.filter(l => l.coordenador_user_id === coordFilter);
  }, [liderancas, coordFilter]);

  // Per-liderança data (filtered)
  const liderancasComVotos = useMemo(() =>
    filteredLiderancas
      .filter(l => ((l as any).votos_estimados || 0) > 0)
      .map(l => ({
        id: l.id,
        nome: l.nome,
        cidade: cidadeMap.get(l.cidade_base_id || '')?.nome || '-',
        coordenador: coordMap.get(l.coordenador_user_id || '')?.nome || '-',
        coordenador_user_id: l.coordenador_user_id,
        votos_estimados: (l as any).votos_estimados || 0,
        forca: l.forca_politica,
        status: l.status,
        cidades_count: l.cidades_representadas?.length || 0,
      }))
      .sort((a, b) => b.votos_estimados - a.votos_estimados),
    [filteredLiderancas, cidadeMap, coordMap]
  );

  // Per-coordenador aggregation (uses all liderancas, not filtered)
  const coordenadorStats = useMemo(() => {
    const map = new Map<string, { nome: string; totalVotos: number; liderancasCount: number; cidadesCount: number }>();
    liderancas.forEach(l => {
      const coordId = l.coordenador_user_id || '__sem_coordenador__';
      const coordNome = coordMap.get(l.coordenador_user_id || '')?.nome || 'Sem Coordenador';
      const votos = (l as any).votos_estimados || 0;
      if (!map.has(coordId)) {
        map.set(coordId, { nome: coordNome, totalVotos: 0, liderancasCount: 0, cidadesCount: 0 });
      }
      const entry = map.get(coordId)!;
      entry.totalVotos += votos;
      entry.liderancasCount += 1;
      entry.cidadesCount += (l.cidades_representadas?.length || 0) + (l.cidade_base_id ? 1 : 0);
    });
    return Array.from(map.values()).sort((a, b) => b.totalVotos - a.totalVotos);
  }, [liderancas, coordMap]);

  // Per-city aggregation (filtered)
  const liderancaVotosByCidade = useMemo(() => {
    const map = new Map<string, number>();
    filteredLiderancas.forEach(l => {
      const votos = (l as any).votos_estimados || 0;
      if (votos > 0 && l.cidade_base_id) {
        map.set(l.cidade_base_id, (map.get(l.cidade_base_id) || 0) + votos);
      }
      (l.cidades_representadas || []).forEach((cid: string) => {
        if (votos > 0) map.set(cid, (map.get(cid) || 0) + votos);
      });
    });
    return map;
  }, [filteredLiderancas]);

  const totalLiderancaVotos = useMemo(() =>
    filteredLiderancas.reduce((a, l) => a + ((l as any).votos_estimados || 0), 0),
    [filteredLiderancas]
  );

  const totalProjetado = useMemo(() =>
    projecoes.reduce((a, p) => a + (p.votos_projetados || 0), 0),
    [projecoes]
  );

  const totalConfirmado = useMemo(() =>
    projecoes.reduce((a, p) => a + (p.votos_confirmados || 0), 0),
    [projecoes]
  );

  const chartData = useMemo(() => {
    // Merge projecoes data with lideranca estimates per city
    const cityDataMap = new Map<string, { cidade: string; projetados: number; confirmados: number; meta: number; estLiderancas: number }>();

    // Add projecoes data
    projecoes.forEach(p => {
      const nome = cidadeMap.get(p.cidade_id)?.nome || '';
      if (!nome) return;
      cityDataMap.set(p.cidade_id, {
        cidade: nome,
        projetados: p.votos_projetados || 0,
        confirmados: p.votos_confirmados || 0,
        meta: p.meta_votos || 0,
        estLiderancas: liderancaVotosByCidade.get(p.cidade_id) || 0,
      });
    });

    // Add cities that have lideranca estimates but no projecao record
    liderancaVotosByCidade.forEach((votos, cidadeId) => {
      if (!cityDataMap.has(cidadeId) && votos > 0) {
        const nome = cidadeMap.get(cidadeId)?.nome || '';
        if (nome) {
          cityDataMap.set(cidadeId, {
            cidade: nome,
            projetados: 0,
            confirmados: 0,
            meta: 0,
            estLiderancas: votos,
          });
        }
      }
    });

    return Array.from(cityDataMap.values())
      .sort((a, b) => (b.estLiderancas + b.projetados) - (a.estLiderancas + a.projetados))
      .slice(0, 30); // Top 30 for readability
  }, [projecoes, cidadeMap, liderancaVotosByCidade]);

  const coordChartData = useMemo(() =>
    coordenadorStats.filter(c => c.totalVotos > 0).map(c => ({
      nome: c.nome.split(' ').slice(0, 2).join(' '),
      votos: c.totalVotos,
      liderancas: c.liderancasCount,
    })),
    [coordenadorStats]
  );

  if (lp || lc || ll) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projeção de Votos</h1>
          <p className="text-muted-foreground">Acompanhe as projeções e metas eleitorais</p>
        </div>
        <div className="flex items-center gap-3">
          <NativeSelect
            value={coordFilter}
            onChange={e => setCoordFilter(e.target.value)}
            className="w-[220px]"
            options={[
              { value: "todos", label: "Todos os coordenadores" },
              { value: "sem_coordenador", label: "Sem coordenador" },
              ...coordenadores.map(c => ({ value: c.user_id, label: c.nome })),
            ]}
          />
          <ProjecaoFormDialog />
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por liderança, coordenador ou cidade..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Total Estimado (Lideranças)</p>
          <p className="text-2xl font-bold">{totalLiderancaVotos.toLocaleString('pt-BR')}</p>
          <p className="text-xs text-muted-foreground">{liderancasComVotos.length} lideranças com estimativa</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Total Projetado</p>
          <p className="text-2xl font-bold">{totalProjetado.toLocaleString('pt-BR')}</p>
          <p className="text-xs text-muted-foreground">{projecoes.length} projeções por cidade</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Total Confirmado</p>
          <p className="text-2xl font-bold">{totalConfirmado.toLocaleString('pt-BR')}</p>
          <p className="text-xs text-muted-foreground">votos confirmados</p>
        </Card>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader><CardTitle className="text-base">Comparativo por Cidade</CardTitle></CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="cidade" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={80} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => v.toLocaleString('pt-BR')} />
                <Bar dataKey="meta" fill="hsl(var(--border))" name="Meta" radius={[2, 2, 0, 0]} />
                <Bar dataKey="projetados" fill="hsl(215, 70%, 50%)" name="Projetados" radius={[2, 2, 0, 0]} />
                <Bar dataKey="confirmados" fill="hsl(142, 72%, 29%)" name="Confirmados" radius={[2, 2, 0, 0]} />
                <Bar dataKey="estLiderancas" fill="hsl(280, 60%, 50%)" name="Est. Lideranças" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <BarChart2 className="h-10 w-10 mb-2 opacity-40" />
              <p className="text-sm">Nenhum dado para exibir.</p>
              <p className="text-xs">Cadastre projeções ou adicione estimativas de votos às lideranças.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs: by liderança and by coordenador */}
      <Tabs defaultValue="liderancas" className="space-y-4">
        <TabsList>
          <TabsTrigger value="liderancas" className="gap-1.5">
            <Users className="h-4 w-4" />
            Por Liderança
          </TabsTrigger>
          <TabsTrigger value="coordenadores" className="gap-1.5">
            <UserCog className="h-4 w-4" />
            Por Coordenador
          </TabsTrigger>
          <TabsTrigger value="cidades">
            Por Cidade
          </TabsTrigger>
        </TabsList>

        {/* Tab: Por Liderança */}
        <TabsContent value="liderancas">
          <Card>
            <CardHeader><CardTitle className="text-base">Estimativa de Votos por Liderança</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Liderança</TableHead>
                      <TableHead>Coordenador</TableHead>
                      <TableHead>Cidade Base</TableHead>
                      <TableHead className="text-right">Votos Estimados</TableHead>
                      <TableHead>Força</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Cidades</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {liderancasComVotos.filter(l => { const q = search.trim().toLowerCase(); return !q || l.nome.toLowerCase().includes(q) || l.coordenador.toLowerCase().includes(q) || l.cidade.toLowerCase().includes(q); }).map(l => (
                      <TableRow key={l.id}>
                        <TableCell className="font-medium">{l.nome}</TableCell>
                        <TableCell className="text-muted-foreground">{l.coordenador}</TableCell>
                        <TableCell>{l.cidade}</TableCell>
                        <TableCell className="text-right font-bold">{l.votos_estimados.toLocaleString('pt-BR')}</TableCell>
                        <TableCell>
                          <Badge variant={l.forca === 'alta' ? 'default' : 'secondary'}>
                            {l.forca === 'alta' ? 'Alta' : l.forca === 'media' ? 'Média' : 'Baixa'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={l.status === 'ativa' ? 'default' : 'outline'}>
                            {l.status === 'ativa' ? 'Ativa' : l.status === 'em_negociacao' ? 'Em Neg.' : 'Potencial'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{l.cidades_count}</TableCell>
                      </TableRow>
                    ))}
                    {liderancasComVotos.length === 0 && (
                      <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhuma liderança com estimativa de votos</TableCell></TableRow>
                    )}
                    {liderancasComVotos.length > 0 && (
                      <TableRow className="bg-muted/50 font-bold">
                        <TableCell colSpan={3}>TOTAL</TableCell>
                        <TableCell className="text-right">{totalLiderancaVotos.toLocaleString('pt-BR')}</TableCell>
                        <TableCell colSpan={3}></TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Por Coordenador */}
        <TabsContent value="coordenadores">
          <div className="space-y-4">
            {coordChartData.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-base">Estimativa por Coordenador</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={coordChartData} layout="vertical" margin={{ left: 100 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                      <YAxis type="category" dataKey="nome" tick={{ fontSize: 11 }} width={95} />
                      <Tooltip formatter={(v: number) => v.toLocaleString('pt-BR')} />
                      <Bar dataKey="votos" fill="hsl(215, 70%, 50%)" name="Votos Estimados" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Coordenador</TableHead>
                        <TableHead className="text-right">Lideranças</TableHead>
                        <TableHead className="text-right">Cidades</TableHead>
                        <TableHead className="text-right">Votos Estimados</TableHead>
                        <TableHead>% do Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {coordenadorStats.filter(c => { const q = search.trim().toLowerCase(); return !q || c.nome.toLowerCase().includes(q); }).map((c, i) => {
                        const pct = totalLiderancaVotos > 0 ? Math.round((c.totalVotos / totalLiderancaVotos) * 100) : 0;
                        return (
                          <TableRow key={i}>
                            <TableCell className="font-medium">{c.nome}</TableCell>
                            <TableCell className="text-right">{c.liderancasCount}</TableCell>
                            <TableCell className="text-right">{c.cidadesCount}</TableCell>
                            <TableCell className="text-right font-bold">{c.totalVotos.toLocaleString('pt-BR')}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Progress value={pct} className="h-2 w-20" />
                                <span className="text-xs text-muted-foreground">{pct}%</span>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {coordenadorStats.length === 0 && (
                        <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum dado disponível</TableCell></TableRow>
                      )}
                      {coordenadorStats.length > 0 && (
                        <TableRow className="bg-muted/50 font-bold">
                          <TableCell>TOTAL</TableCell>
                          <TableCell className="text-right">{liderancas.length}</TableCell>
                          <TableCell className="text-right">-</TableCell>
                          <TableCell className="text-right">{totalLiderancaVotos.toLocaleString('pt-BR')}</TableCell>
                          <TableCell></TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab: Por Cidade (original projection table) */}
        <TabsContent value="cidades">
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cidade</TableHead>
                      <TableHead>Liderança</TableHead>
                      <TableHead className="text-right">Est. Lideranças</TableHead>
                      <TableHead className="text-right">Projetados</TableHead>
                      <TableHead className="text-right">Confirmados</TableHead>
                      <TableHead className="text-right">Meta</TableHead>
                      <TableHead>Progresso</TableHead>
                      <TableHead>Confiança</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {projecoes.filter(p => { const q = search.trim().toLowerCase(); if (!q) return true; const cidade = (cidadeMap.get(p.cidade_id)?.nome || "").toLowerCase(); const lid = (p.lideranca_id ? liderancaMap.get(p.lideranca_id)?.nome || "" : "").toLowerCase(); return cidade.includes(q) || lid.includes(q); }).map(p => {
                      const pct = p.meta_votos ? Math.round(((p.votos_confirmados || 0) / p.meta_votos) * 100) : 0;
                      return (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">{cidadeMap.get(p.cidade_id)?.nome}</TableCell>
                          <TableCell>{p.lideranca_id ? liderancaMap.get(p.lideranca_id)?.nome || '-' : '-'}</TableCell>
                          <TableCell className="text-right font-medium" style={{ color: 'hsl(280, 60%, 50%)' }}>{(liderancaVotosByCidade.get(p.cidade_id) || 0).toLocaleString('pt-BR')}</TableCell>
                          <TableCell className="text-right">{(p.votos_projetados || 0).toLocaleString('pt-BR')}</TableCell>
                          <TableCell className="text-right">{(p.votos_confirmados || 0).toLocaleString('pt-BR')}</TableCell>
                          <TableCell className="text-right">{(p.meta_votos || 0).toLocaleString('pt-BR')}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress value={pct} className="h-2 w-20" />
                              <span className="text-xs text-muted-foreground">{pct}%</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={p.nivel_confianca === 'alto' ? 'default' : p.nivel_confianca === 'medio' ? 'secondary' : 'destructive'}>
                              {p.nivel_confianca}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {projecoes.length === 0 && (
                      <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhuma projeção cadastrada</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
