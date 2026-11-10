import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCoordenadores } from "@/hooks/useCoordenadores";
import {
  useContatosCoordenacao,
  useCreateContato,
  useDeleteContato,
  type ContatoCoordenacao,
} from "@/hooks/useContatosCoordenacao";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { SearchSelect } from "@/components/ui/search-select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Star, AlertCircle, PhoneCall, MessageSquare, Users, Trophy, Clock, Plus, Trash2, FileText, Search } from "lucide-react";
import { toast } from "sonner";

const selectClasses =
  "flex h-10 w-full items-center rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2";

const ALERT_DAYS = 5;

interface CoordenadorRanking {
  user_id: string;
  nome: string;
  email: string;
  cor: string | null;
  votos_liderancas: number;
  total_liderancas: number;
  liderancas_ativas: number;
  eleitores_captados: number;
  total_contatos: number;
  ultimo_contato: string | null;
  dias_sem_contato: number | null;
  precisa_contato: boolean;
  score: number;
  estrelas: number;
}

export default function ContatoCoordenacao() {
  const { data: coordenadores = [], isLoading: loadingCoord } = useCoordenadores();
  const { data: contatos = [], isLoading: loadingContatos } = useContatosCoordenacao();
  const createContato = useCreateContato();
  const deleteContato = useDeleteContato();

  const [openDialog, setOpenDialog] = useState(false);
  const [selectedCoord, setSelectedCoord] = useState<string>("");
  const [tipoContato, setTipoContato] = useState("ligacao");
  const [assunto, setAssunto] = useState("");
  const [relatorio, setRelatorio] = useState("");
  const [proximosPassos, setProximosPassos] = useState("");

  const [filtroAlerta, setFiltroAlerta] = useState(false);
  const [searchCoord, setSearchCoord] = useState("");
  const [coordHistorico, setCoordHistorico] = useState<string | null>(null);
  const [contatoToDelete, setContatoToDelete] = useState<ContatoCoordenacao | null>(null);

  // Lideranças vinculadas (votos + status)
  const { data: liderancas = [] } = useQuery({
    queryKey: ["liderancas-para-ranking"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("liderancas")
        .select("id, coordenador_user_id, votos_estimados, status");
      if (error) throw error;
      return data || [];
    },
  });

  // Eleitores captados (por liderança)
  const { data: eleitores = [] } = useQuery({
    queryKey: ["eleitores-para-ranking"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("eleitores_captados")
        .select("id, lideranca_id, captado_por_user_id");
      if (error) throw error;
      return data || [];
    },
  });

  const ranking = useMemo<CoordenadorRanking[]>(() => {
    const now = Date.now();

    // Mapear última interação por coordenador
    const ultimoContatoMap = new Map<string, string>();
    const totalContatosMap = new Map<string, number>();
    contatos.forEach((c) => {
      totalContatosMap.set(c.coordenador_user_id, (totalContatosMap.get(c.coordenador_user_id) ?? 0) + 1);
      const prev = ultimoContatoMap.get(c.coordenador_user_id);
      if (!prev || new Date(c.data_contato) > new Date(prev)) {
        ultimoContatoMap.set(c.coordenador_user_id, c.data_contato);
      }
    });

    // Computar métricas brutas
    const rows = coordenadores.map((c) => {
      const lids = liderancas.filter((l: any) => l.coordenador_user_id === c.user_id);
      const lidIds = new Set(lids.map((l: any) => l.id));
      const votos = lids.reduce((s: number, l: any) => s + (l.votos_estimados ?? 0), 0);
      const ativas = lids.filter((l: any) => l.status === "ativa").length;
      const captados = eleitores.filter(
        (e: any) => (e.lideranca_id && lidIds.has(e.lideranca_id)) || e.captado_por_user_id === c.user_id,
      ).length;
      const ultimo = ultimoContatoMap.get(c.user_id) ?? null;
      const dias = ultimo
        ? Math.floor((now - new Date(ultimo).getTime()) / (1000 * 60 * 60 * 24))
        : null;
      const precisaContato = dias === null || dias >= ALERT_DAYS;

      return {
        user_id: c.user_id,
        nome: c.nome,
        email: c.email,
        cor: c.cor,
        votos_liderancas: votos,
        total_liderancas: lids.length,
        liderancas_ativas: ativas,
        eleitores_captados: captados,
        total_contatos: totalContatosMap.get(c.user_id) ?? 0,
        ultimo_contato: ultimo,
        dias_sem_contato: dias,
        precisa_contato: precisaContato,
        score: 0,
        estrelas: 0,
      };
    });

    // Normalizar para ranking 0-100 (relativo ao máximo)
    const maxVotos = Math.max(1, ...rows.map((r) => r.votos_liderancas));
    const maxCaptados = Math.max(1, ...rows.map((r) => r.eleitores_captados));
    const maxLids = Math.max(1, ...rows.map((r) => r.total_liderancas));

    rows.forEach((r) => {
      // Frequência de contato: 100 se contato <= 5 dias; cai linearmente até 0 em 30 dias; 0 se nunca
      let freq = 0;
      if (r.dias_sem_contato !== null) {
        if (r.dias_sem_contato <= ALERT_DAYS) freq = 100;
        else if (r.dias_sem_contato >= 30) freq = 0;
        else freq = Math.max(0, 100 - ((r.dias_sem_contato - ALERT_DAYS) / (30 - ALERT_DAYS)) * 100);
      }

      const sVotos = (r.votos_liderancas / maxVotos) * 100;
      const sCaptados = (r.eleitores_captados / maxCaptados) * 100;
      const sLids = (r.total_liderancas / maxLids) * 100;

      const score = sVotos * 0.4 + sCaptados * 0.3 + sLids * 0.15 + freq * 0.15;
      r.score = Math.round(score);

      // Estrelas 1-5 (mínimo 1 quando coord está cadastrado)
      if (score >= 80) r.estrelas = 5;
      else if (score >= 60) r.estrelas = 4;
      else if (score >= 40) r.estrelas = 3;
      else if (score >= 20) r.estrelas = 2;
      else r.estrelas = 1;
    });

    return rows.sort((a, b) => b.score - a.score);
  }, [coordenadores, liderancas, eleitores, contatos]);

  const alertas = ranking.filter((r) => r.precisa_contato);
  const visibleRanking = (filtroAlerta ? alertas : ranking).filter((r) => {
    const q = searchCoord.trim().toLowerCase();
    return !q || r.nome.toLowerCase().includes(q) || (r.email || "").toLowerCase().includes(q);
  });

  const handleAbrirNovoContato = (userId?: string) => {
    setSelectedCoord(userId ?? "");
    setTipoContato("ligacao");
    setAssunto("");
    setRelatorio("");
    setProximosPassos("");
    setOpenDialog(true);
  };

  const handleSalvar = async () => {
    if (!selectedCoord) return toast.error("Selecione um coordenador");
    if (!assunto.trim()) return toast.error("Informe o assunto");
    try {
      await createContato.mutateAsync({
        coordenador_user_id: selectedCoord,
        tipo_contato: tipoContato,
        assunto: assunto.trim(),
        relatorio: relatorio.trim() || undefined,
        proximos_passos: proximosPassos.trim() || undefined,
      });
      toast.success("Contato registrado com sucesso");
      setOpenDialog(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao registrar contato");
    }
  };

  const handleDeleteContato = async () => {
    if (!contatoToDelete) return;
    try {
      await deleteContato.mutateAsync(contatoToDelete.id);
      toast.success("Registro removido");
      setContatoToDelete(null);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao remover");
    }
  };

  const isLoading = loadingCoord || loadingContatos;
  const coordHistoricoData = coordHistorico
    ? ranking.find((r) => r.user_id === coordHistorico)
    : null;
  const historicoContatos = coordHistorico
    ? contatos.filter((c) => c.coordenador_user_id === coordHistorico)
    : [];

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <PhoneCall className="h-7 w-7 text-primary" />
            Contato Coordenação
          </h1>
          <p className="text-sm text-muted-foreground">
            Acompanhe coordenações, registre contatos e mantenha alinhamento contínuo.
          </p>
        </div>
        <Button onClick={() => handleAbrirNovoContato()}>
          <Plus className="h-4 w-4 mr-2" /> Registrar contato
        </Button>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Coordenadores</p>
                <p className="text-2xl font-bold">{ranking.length}</p>
              </div>
              <Users className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card className={alertas.length > 0 ? "border-destructive/50" : ""}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Pendentes (5+ dias)</p>
                <p className="text-2xl font-bold text-destructive">{alertas.length}</p>
              </div>
              <AlertCircle className={`h-5 w-5 ${alertas.length > 0 ? "text-destructive" : "text-muted-foreground"}`} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total de contatos</p>
                <p className="text-2xl font-bold">{contatos.length}</p>
              </div>
              <MessageSquare className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Top coordenação</p>
                <p className="text-sm font-bold truncate">
                  {ranking[0]?.nome ?? "—"}
                </p>
              </div>
              <Trophy className="h-5 w-5 text-amber-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerta global */}
      {alertas.length > 0 && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-destructive">
                {alertas.length} coordenação{alertas.length > 1 ? "ões" : ""} aguardando contato
              </p>
              <p className="text-sm text-muted-foreground">
                Faz mais de {ALERT_DAYS} dias desde a última conversa. Mantenha o alinhamento ativo.
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={() => setFiltroAlerta(!filtroAlerta)}>
              {filtroAlerta ? "Ver todos" : "Filtrar pendentes"}
            </Button>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="ranking" className="w-full">
        <TabsList>
          <TabsTrigger value="ranking">Ranking de Coordenações</TabsTrigger>
          <TabsTrigger value="historico">Histórico de Contatos</TabsTrigger>
        </TabsList>

        <TabsContent value="ranking" className="space-y-3 mt-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar coordenador por nome..." value={searchCoord} onChange={e => setSearchCoord(e.target.value)} className="pl-9" />
          </div>
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Carregando…</p>
          ) : visibleRanking.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                Nenhum coordenador encontrado.
              </CardContent>
            </Card>
          ) : (
            visibleRanking.map((r, idx) => (
              <Card key={r.user_id} className={r.precisa_contato ? "border-destructive/40" : ""}>
                <CardContent className="p-4">
                  <div className="flex flex-col md:flex-row md:items-center gap-4">
                    {/* Posição + cor */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div
                        className="h-10 w-10 rounded-full flex items-center justify-center font-bold text-white shrink-0"
                        style={{ backgroundColor: r.cor ?? "hsl(var(--primary))" }}
                      >
                        {idx + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold truncate">{r.nome}</p>
                        <p className="text-xs text-muted-foreground truncate">{r.email}</p>
                        <div className="flex items-center gap-1 mt-1">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              className={`h-4 w-4 ${
                                s <= r.estrelas ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"
                              }`}
                            />
                          ))}
                          <span className="text-xs text-muted-foreground ml-1">
                            {r.estrelas}/5 · score {r.score}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Métricas */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center md:text-left">
                      <div>
                        <p className="text-xs text-muted-foreground">Votos lideranças</p>
                        <p className="font-semibold">{r.votos_liderancas.toLocaleString("pt-BR")}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Lideranças</p>
                        <p className="font-semibold">{r.total_liderancas} <span className="text-xs text-muted-foreground">({r.liderancas_ativas} ativas)</span></p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Eleitores captados</p>
                        <p className="font-semibold">{r.eleitores_captados.toLocaleString("pt-BR")}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Último contato</p>
                        {r.dias_sem_contato === null ? (
                          <Badge variant="destructive" className="text-[10px]">Nunca</Badge>
                        ) : (
                          <Badge
                            variant={r.precisa_contato ? "destructive" : "secondary"}
                            className="text-[10px] gap-1"
                          >
                            <Clock className="h-3 w-3" />
                            {r.dias_sem_contato === 0 ? "Hoje" : `${r.dias_sem_contato}d atrás`}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Ações */}
                    <div className="flex flex-col md:flex-row gap-2">
                      <Button
                        size="sm"
                        variant={r.precisa_contato ? "default" : "outline"}
                        onClick={() => handleAbrirNovoContato(r.user_id)}
                      >
                        <PhoneCall className="h-4 w-4 mr-1" /> Registrar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setCoordHistorico(r.user_id)}
                      >
                        <FileText className="h-4 w-4 mr-1" /> {r.total_contatos}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="historico" className="space-y-3 mt-4">
          {contatos.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-muted-foreground">
                Nenhum contato registrado ainda.
              </CardContent>
            </Card>
          ) : (
            contatos.map((c) => {
              const coord = coordenadores.find((co) => co.user_id === c.coordenador_user_id);
              return (
                <Card key={c.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <Badge variant="outline" className="capitalize">{c.tipo_contato}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(c.data_contato).toLocaleString("pt-BR")}
                          </span>
                          <span className="text-sm font-medium">→ {coord?.nome ?? "Coordenador"}</span>
                        </div>
                        <p className="font-semibold text-sm">{c.assunto}</p>
                        {c.relatorio && (
                          <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{c.relatorio}</p>
                        )}
                        {c.proximos_passos && (
                          <p className="text-xs text-primary mt-2">
                            <strong>Próximos passos:</strong> {c.proximos_passos}
                          </p>
                        )}
                      </div>
                      <Button size="icon" variant="ghost" onClick={() => setContatoToDelete(c)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>
      </Tabs>

      {/* Dialog: novo contato */}
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="max-w-lg max-h-[calc(100dvh-1rem)] overflow-auto">
          <DialogHeader>
            <DialogTitle>Registrar contato com coordenação</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Coordenador *</Label>
              <SearchSelect
                value={selectedCoord}
                onChange={setSelectedCoord}
                placeholder="Selecione…"
                searchPlaceholder="Buscar coordenador..."
                options={coordenadores.map((c) => ({ value: c.user_id, label: c.nome, hint: c.email }))}
              />
            </div>
            <div>
              <Label>Tipo de contato</Label>
              <SearchSelect
                value={tipoContato}
                onChange={setTipoContato}
                placeholder="Selecione…"
                searchPlaceholder="Buscar tipo..."
                options={[
                  { value: "ligacao", label: "Ligação" },
                  { value: "whatsapp", label: "WhatsApp" },
                  { value: "reuniao", label: "Reunião" },
                  { value: "presencial", label: "Visita presencial" },
                  { value: "email", label: "E-mail" },
                ]}
              />
            </div>
            <div>
              <Label>Assunto *</Label>
              <Input
                value={assunto}
                onChange={(e) => setAssunto(e.target.value)}
                placeholder="Ex.: Alinhamento de agenda na zona leste"
                maxLength={200}
              />
            </div>
            <div>
              <Label>Relatório (resumo do que foi tratado)</Label>
              <Textarea
                value={relatorio}
                onChange={(e) => setRelatorio(e.target.value)}
                placeholder="Pontos discutidos, ideias, decisões…"
                rows={4}
                maxLength={2000}
              />
            </div>
            <div>
              <Label>Próximos passos</Label>
              <Textarea
                value={proximosPassos}
                onChange={(e) => setProximosPassos(e.target.value)}
                placeholder="Ações combinadas e prazos"
                rows={2}
                maxLength={1000}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDialog(false)}>Cancelar</Button>
            <Button onClick={handleSalvar} disabled={createContato.isPending}>
              {createContato.isPending ? "Salvando…" : "Salvar contato"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: histórico de um coordenador */}
      <Dialog open={!!coordHistorico} onOpenChange={(o) => !o && setCoordHistorico(null)}>
        <DialogContent className="max-w-2xl max-h-[calc(100dvh-1rem)] overflow-auto">
          <DialogHeader>
            <DialogTitle>
              Histórico — {coordHistoricoData?.nome}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            {historicoContatos.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nenhum contato registrado ainda.
              </p>
            ) : (
              historicoContatos.map((c) => (
                <Card key={c.id}>
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Badge variant="outline" className="capitalize text-[10px]">{c.tipo_contato}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(c.data_contato).toLocaleString("pt-BR")}
                      </span>
                    </div>
                    <p className="font-semibold text-sm">{c.assunto}</p>
                    {c.relatorio && <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{c.relatorio}</p>}
                    {c.proximos_passos && (
                      <p className="text-xs text-primary mt-1"><strong>Próximos passos:</strong> {c.proximos_passos}</p>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCoordHistorico(null)}>Fechar</Button>
            <Button
              onClick={() => {
                const id = coordHistorico;
                setCoordHistorico(null);
                if (id) handleAbrirNovoContato(id);
              }}
            >
              <Plus className="h-4 w-4 mr-1" /> Novo contato
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!contatoToDelete} onOpenChange={(o) => !o && setContatoToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover registro de contato?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteContato} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
