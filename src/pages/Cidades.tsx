import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { useCidades, useProjecoes, useLiderancas } from "@/hooks/useSupabaseData";
import { useCabosEleitorais } from "@/hooks/useCabosEleitorais";
import { useCoordenadores } from "@/hooks/useCoordenadores";
import { Search, Loader2, UserCog, Download, X } from "lucide-react";
import CoordenadorEditDialog from "@/components/CoordenadorEditDialog";
import { exportStyledExcel } from "@/lib/exportExcelStyled";
import { toast } from "sonner";

const FAIXAS = [
  { value: "all", label: "Todas as faixas", max: Infinity, min: 0 },
  { value: "1000", label: "Até 1.000 hab.", min: 0, max: 1000 },
  { value: "2000", label: "Até 2.000 hab.", min: 1000, max: 2000 },
  { value: "5000", label: "Até 5.000 hab.", min: 2000, max: 5000 },
  { value: "10000", label: "Até 10.000 hab.", min: 5000, max: 10000 },
  { value: "20000", label: "Até 20.000 hab.", min: 10000, max: 20000 },
  { value: "40000", label: "Até 40.000 hab.", min: 20000, max: 40000 },
  { value: "80000", label: "Até 80.000 hab.", min: 40000, max: 80000 },
  { value: "160000", label: "Até 160.000 hab.", min: 80000, max: 160000 },
  { value: "320000", label: "Até 320.000 hab.", min: 160000, max: 320000 },
  { value: "acima", label: "Acima de 320.000 hab.", min: 320000, max: Infinity },
];

export default function Cidades() {
  const [search, setSearch] = useState("");
  const [faixa, setFaixa] = useState("all");
  const [popMin, setPopMin] = useState<string>("");
  const [popMax, setPopMax] = useState<string>("");
  const [representacao, setRepresentacao] = useState("all");
  const [regiao, setRegiao] = useState("all");
  const { data: cidades = [], isLoading: lc } = useCidades();
  const { data: projecoes = [], isLoading: lp } = useProjecoes();
  const { data: liderancas = [] } = useLiderancas();
  const { data: cabos = [] } = useCabosEleitorais();
  const { data: coordenadores = [] } = useCoordenadores();
  const [editCidade, setEditCidade] = useState<any>(null);

  const projMap = useMemo(() => new Map(projecoes.map(p => [p.cidade_id, p])), [projecoes]);

  // Map coordenador_cidades -> coordinator names per city
  const coordByCidade = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const c of coordenadores) {
      for (const cidId of c.cidades_ids) {
        const arr = map.get(cidId) || [];
        arr.push(c.nome);
        map.set(cidId, arr);
      }
    }
    return map;
  }, [coordenadores]);

  const nomeToId = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of cidades) m.set(c.nome.trim().toLowerCase(), c.id);
    return m;
  }, [cidades]);

  const liderancasByCidade = useMemo(() => {
    const map = new Map<string, number>();
    const add = (id?: string | null) => { if (id) map.set(id, (map.get(id) || 0) + 1); };
    for (const l of liderancas) {
      add(l.cidade_base_id);
      for (const nome of ((l as any).cidades_representadas || []) as string[]) {
        const id = nomeToId.get(String(nome).trim().toLowerCase());
        if (id && id !== l.cidade_base_id) add(id);
      }
    }
    return map;
  }, [liderancas, nomeToId]);

  const cabosByCidade = useMemo(() => {
    const map = new Map<string, number>();
    const add = (id?: string | null) => { if (id) map.set(id, (map.get(id) || 0) + 1); };
    for (const c of cabos) {
      add(c.cidade_base_id);
      for (const nome of ((c as any).cidades_representadas || []) as string[]) {
        const id = nomeToId.get(String(nome).trim().toLowerCase());
        if (id && id !== c.cidade_base_id) add(id);
      }
    }
    return map;
  }, [cabos, nomeToId]);

  // Aggregate votos_estimados from liderancas per city
  const votosByCidade = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of liderancas) {
      const votos = (l as any).votos_estimados || 0;
      if (l.cidade_base_id) {
        map.set(l.cidade_base_id, (map.get(l.cidade_base_id) || 0) + votos);
      }
    }
    return map;
  }, [liderancas]);

  const regioes = useMemo(
    () => Array.from(new Set(cidades.map(c => c.regiao_administrativa).filter(Boolean) as string[])).sort(),
    [cidades],
  );

  const filtered = useMemo(() => {
    const faixaCfg = FAIXAS.find(f => f.value === faixa) || FAIXAS[0];
    const minCustom = popMin ? Number(popMin) : null;
    const maxCustom = popMax ? Number(popMax) : null;
    const q = search.trim().toLowerCase();
    return cidades.filter(c => {
      const coordNames = coordByCidade.get(c.id)?.join(', ') || c.coordenador_nome || '';
      const matchSearch = !q ||
        c.nome.toLowerCase().includes(q) ||
        (c.regiao_administrativa || '').toLowerCase().includes(q) ||
        coordNames.toLowerCase().includes(q);
      if (!matchSearch) return false;

      if (regiao !== "all" && c.regiao_administrativa !== regiao) return false;

      const hab = c.populacao || 0;
      if (minCustom != null && hab < minCustom) return false;
      if (maxCustom != null && hab > maxCustom) return false;
      if (minCustom == null && maxCustom == null && faixa !== "all" && !(hab > faixaCfg.min && hab <= faixaCfg.max)) return false;

      const nLid = liderancasByCidade.get(c.id) || 0;
      const nCabo = cabosByCidade.get(c.id) || 0;
      const temCoord = !!coordNames;
      if (representacao === "lideranca" && nLid === 0) return false;
      if (representacao === "coordenador" && !temCoord) return false;
      if (representacao === "cabo" && nCabo === 0) return false;
      if (representacao === "com" && nLid === 0 && nCabo === 0 && !temCoord) return false;
      if (representacao === "sem" && (nLid > 0 || nCabo > 0 || temCoord)) return false;

      return true;
    });
  }, [cidades, search, faixa, popMin, popMax, regiao, representacao, coordByCidade, liderancasByCidade, cabosByCidade]);

  const hasFilters = search || faixa !== "all" || popMin || popMax || representacao !== "all" || regiao !== "all";

  async function handleExport() {
    if (filtered.length === 0) { toast.error("Nenhuma cidade para exportar"); return; }
    const rows = filtered.map(c => {
      const proj = projMap.get(c.id);
      const coordNome = coordByCidade.get(c.id)?.join(', ') || c.coordenador_nome || '';
      return [
        c.nome,
        c.regiao_administrativa || '-',
        c.populacao || 0,
        c.eleitores || 0,
        coordNome || '-',
        liderancasByCidade.get(c.id) || 0,
        cabosByCidade.get(c.id) || 0,
        votosByCidade.get(c.id) || 0,
        proj?.votos_projetados || 0,
        proj?.meta_votos || 0,
      ];
    });
    await exportStyledExcel(
      "cidades",
      "Cidades",
      [
        { header: "Cidade", width: 28 },
        { header: "Região", width: 22 },
        { header: "Habitantes", width: 14 },
        { header: "Eleitores", width: 14 },
        { header: "Coordenador", width: 28 },
        { header: "Lideranças", width: 12 },
        { header: "Cabos", width: 12 },
        { header: "Apoiadores Est.", width: 16 },
        { header: "Apoiadores Proj.", width: 16 },
        { header: "Meta", width: 12 },
      ],
      rows,
      `Relatório de Cidades — ${filtered.length} registro(s)`,
    );
    toast.success("Planilha gerada!");
  }

  if (lc || lp) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Cidades</h1>
        <p className="text-muted-foreground">Gerenciamento de cidades do Estado de São Paulo — {cidades.length} cidades</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar cidade ou coordenador..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <NativeSelect
          value={regiao}
          onChange={e => setRegiao(e.target.value)}
          className="w-full sm:w-[190px] h-10 text-xs"
          options={[{ value: "all", label: "Todas as Regiões" }, ...regioes.map(r => ({ value: r, label: r }))]}
        />
        <NativeSelect
          value={representacao}
          onChange={e => setRepresentacao(e.target.value)}
          className="w-full sm:w-[200px] h-10 text-xs"
          options={[
            { value: "all", label: "Toda representação" },
            { value: "com", label: "Com representante" },
            { value: "lideranca", label: "Com liderança" },
            { value: "coordenador", label: "Com coordenador" },
            { value: "cabo", label: "Com cabo eleitoral" },
            { value: "sem", label: "Sem representante" },
          ]}
        />
        <NativeSelect
          value={faixa}
          onChange={e => setFaixa(e.target.value)}
          className="w-full sm:w-[190px] h-10 text-xs"
          options={FAIXAS.map(f => ({ value: f.value, label: f.label }))}
        />
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            placeholder="De"
            value={popMin}
            onChange={e => setPopMin(e.target.value)}
            className="w-[90px] h-10 text-xs"
          />
          <span className="text-muted-foreground text-xs">até</span>
          <Input
            type="number"
            min={0}
            placeholder="Até"
            value={popMax}
            onChange={e => setPopMax(e.target.value)}
            className="w-[90px] h-10 text-xs"
          />
        </div>
        {hasFilters && (
          <Button variant="ghost" size="sm" className="h-10 gap-1 text-xs" onClick={() => { setSearch(""); setFaixa("all"); setPopMin(""); setPopMax(""); setRepresentacao("all"); setRegiao("all"); }}>
            <X className="w-3 h-3" /> Limpar
          </Button>
        )}
        <Button variant="outline" size="sm" className="h-10 gap-2" onClick={handleExport}>
          <Download className="w-4 h-4" /> Baixar Excel
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">{filtered.length} cidade(s) no filtro atual</p>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cidade</TableHead>
                  <TableHead>Região</TableHead>
                  <TableHead>Coordenador</TableHead>
                  <TableHead className="text-right">Lideranças</TableHead>
                  <TableHead className="text-right">Cabos</TableHead>
                  <TableHead className="text-right">Habitantes</TableHead>
                  <TableHead className="text-right">Eleitores</TableHead>
                  <TableHead className="text-right">Apoiadores Est.</TableHead>
                  <TableHead className="text-right">Apoiadores Proj.</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(c => {
                  const proj = projMap.get(c.id);
                  const votosLiderancas = votosByCidade.get(c.id) || 0;
                  const votosProj = proj?.votos_projetados || 0;
                  const totalRef = votosLiderancas || votosProj;
                  const meta = proj?.meta_votos || 0;
                  const ratio = meta > 0 ? totalRef / meta : 0;

                  // Show coordinator from coordenador_cidades first, fallback to cidades table
                  const coordFromTable = coordByCidade.get(c.id);
                  const coordNome = coordFromTable?.join(', ') || c.coordenador_nome || '';

                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.nome}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{c.regiao_administrativa}</TableCell>
                      <TableCell>
                        {coordNome ? (
                          <span className="font-medium">{coordNome}</span>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{liderancasByCidade.get(c.id) || 0}</TableCell>
                      <TableCell className="text-right">{cabosByCidade.get(c.id) || 0}</TableCell>
                      <TableCell className="text-right">{(c.populacao || 0).toLocaleString('pt-BR')}</TableCell>
                      <TableCell className="text-right">{(c.eleitores || 0).toLocaleString('pt-BR')}</TableCell>
                      <TableCell className="text-right font-medium">
                        {votosLiderancas > 0 ? votosLiderancas.toLocaleString('pt-BR') : '-'}
                      </TableCell>
                      <TableCell className="text-right">{votosProj > 0 ? votosProj.toLocaleString('pt-BR') : '-'}</TableCell>
                      <TableCell>
                        {totalRef > 0 ? (
                          <Badge variant={ratio >= 0.75 ? 'default' : ratio >= 0.5 ? 'secondary' : 'destructive'}>
                            {ratio >= 0.75 ? 'Alta' : ratio >= 0.5 ? 'Média' : 'Baixa'}
                          </Badge>
                        ) : (
                          <Badge variant="outline">Sem dados</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => setEditCidade(c)} title="Editar coordenador">
                          <UserCog className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground py-8">Nenhuma cidade encontrada</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {editCidade && (
        <CoordenadorEditDialog
          open={!!editCidade}
          onOpenChange={open => { if (!open) setEditCidade(null); }}
          cidade={editCidade}
        />
      )}
    </div>
  );
}
