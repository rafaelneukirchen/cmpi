import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useAgenda, useCidades, useProfilesMap } from "@/hooks/useSupabaseData";
import { useAuth } from "@/hooks/useAuth";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { Calendar as CalendarIcon, MapPin, Loader2, Pencil, Target, User, Users, Check, X, Clock, Search } from "lucide-react";

import { DeleteConfirmDialog } from "@/components/logistics/DeleteConfirmDialog";
import AgendaFormDialog from "@/components/AgendaFormDialog";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const tipoLabels: Record<string, string> = { reuniao: 'Reunião', comicio: 'Comício', visita: 'Visita', carreata: 'Carreata', debate: 'Debate' };
const tipoColors: Record<string, string> = { reuniao: 'default', comicio: 'destructive', visita: 'secondary', carreata: 'outline', debate: 'default' };

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function Agenda() {
  const { data: agenda = [], isLoading: la } = useAgenda();
  const { data: cidades = [], isLoading: lc } = useCidades();
  const { data: profiles = [] } = useProfilesMap();
  const { user, userRole } = useAuth();
  const { data: permissions = [] } = useUserPermissions();
  const cidadeMap = useMemo(() => new Map(cidades.map(c => [c.id, c])), [cidades]);
  const profileMap = useMemo(() => new Map(profiles.map(p => [p.user_id, p])), [profiles]);
  const queryClient = useQueryClient();

  const isAdmin = userRole === "admin";
  const hasConjunta = isAdmin || permissions.includes("agenda_conjunta");

  const [view, setView] = useState<"mine" | "all">(hasConjunta ? "all" : "mine");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [search, setSearch] = useState("");


  // Filtra por visão (minha vs todos)
  const visibleAgenda = useMemo(() => {
    if (view === "mine") {
      return agenda.filter((a: any) => a.criado_por_user_id === user?.id);
    }
    return agenda;
  }, [agenda, view, user?.id]);

  // Datas com eventos (para destacar no calendário)
  const eventDates = useMemo(
    () => visibleAgenda.map((a: any) => new Date(a.data)),
    [visibleAgenda]
  );

  // Eventos do dia selecionado
  const dayAgenda = useMemo(() => {
    let arr = visibleAgenda;
    if (selectedDate) arr = arr.filter((a: any) => isSameDay(new Date(a.data), selectedDate));
    const q = search.trim().toLowerCase();
    if (q) {
      arr = arr.filter((a: any) =>
        (a.evento || "").toLowerCase().includes(q) ||
        (cidadeMap.get(a.cidade_id)?.nome || "").toLowerCase().includes(q) ||
        (a.responsavel || "").toLowerCase().includes(q)
      );
    }
    return arr;
  }, [visibleAgenda, selectedDate, search, cidadeMap]);


  async function handleDelete(id: string) {
    const { error } = await supabase.from("agenda_campanha").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Evento excluído!");
    queryClient.invalidateQueries({ queryKey: ["agenda"] });
  }

  async function handleApprove(id: string) {
    const { error } = await supabase.from("agenda_campanha").update({ status: "aprovado" } as any).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Evento aprovado!");
    queryClient.invalidateQueries({ queryKey: ["agenda"] });
  }

  async function handleReject(id: string) {
    const { error } = await supabase.from("agenda_campanha").update({ status: "rejeitado" } as any).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Evento rejeitado.");
    queryClient.invalidateQueries({ queryKey: ["agenda"] });
  }

  const pendentes = (agenda as any[]).filter(a => a.status === "pendente");

  if (la || lc) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Agenda de Campanha</h1>
          <p className="text-muted-foreground">
            {view === "all" && hasConjunta
              ? "Visão conjunta — agenda de todos os coordenadores"
              : "Seus próximos eventos e compromissos"}
          </p>
          {isAdmin && pendentes.length > 0 && (
            <Badge variant="secondary" className="mt-2 gap-1 bg-amber-500/15 text-amber-700 border-amber-500/30">
              <Clock className="h-3 w-3" />
              {pendentes.length} evento{pendentes.length !== 1 ? "s" : ""} aguardando aprovação
            </Badge>
          )}
          {!isAdmin && (
            <p className="text-xs text-muted-foreground mt-1">Novos eventos passam por aprovação do administrador antes de aparecer para todos.</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasConjunta && (
            <ToggleGroup
              type="single"
              value={view}
              onValueChange={(v) => v && setView(v as "mine" | "all")}
              variant="outline"
              size="sm"
            >
              <ToggleGroupItem value="mine" aria-label="Minha agenda">
                <User className="h-4 w-4 mr-1" /> Minha
              </ToggleGroupItem>
              <ToggleGroupItem value="all" aria-label="Todos">
                <Users className="h-4 w-4 mr-1" /> Todos
              </ToggleGroupItem>
            </ToggleGroup>
          )}
          <AgendaFormDialog />
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por evento, cidade ou responsável..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
        {/* Calendário */}
        <Card className="w-fit">
          <CardContent className="p-3">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              modifiers={{ hasEvent: eventDates }}
              modifiersClassNames={{
                hasEvent: "relative font-bold text-primary after:content-[''] after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1 after:h-1 after:rounded-full after:bg-primary",
              }}
              className={cn("p-3 pointer-events-auto")}
            />
            <div className="mt-2 flex items-center justify-between px-1">
              <span className="text-xs text-muted-foreground">
                {dayAgenda.length} evento{dayAgenda.length !== 1 ? "s" : ""} no dia
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setSelectedDate(undefined)}
              >
                Ver todos
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Lista de eventos */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 content-start">
          {dayAgenda.map(a => {
            const ev = a as any;
            const endereco = [ev.endereco, ev.bairro].filter(Boolean).join(', ');
            const ownerId = ev.criado_por_user_id as string | undefined;
            const owner = ownerId ? profileMap.get(ownerId) : null;
            const ownerName = owner?.nome || (ownerId ? "Outro coordenador" : "Sem dono");
            const ownerColor = owner?.cor || "#64748b";
            const isMine = ownerId && user?.id === ownerId;
            const canEdit = isAdmin || isMine;

            const status = (ev.status as string) || "aprovado";
            const statusBadge = status === "pendente"
              ? { label: "Pendente", variant: "secondary" as const, icon: Clock, className: "bg-amber-500/15 text-amber-700 border-amber-500/30" }
              : status === "rejeitado"
                ? { label: "Rejeitado", variant: "destructive" as const, icon: X, className: "" }
                : null;

            return (
              <Card key={a.id} className={`hover:shadow-md transition-shadow border-l-4 ${status === "pendente" ? "opacity-80" : ""} ${status === "rejeitado" ? "opacity-60" : ""}`} style={{ borderLeftColor: ownerColor }}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3 gap-2">
                    <div className="flex items-center gap-1 flex-wrap">
                      <Badge variant={tipoColors[a.tipo_evento] as any}>{tipoLabels[a.tipo_evento] || a.tipo_evento}</Badge>
                      {statusBadge && (
                        <Badge variant={statusBadge.variant} className={`gap-1 ${statusBadge.className}`}>
                          <statusBadge.icon className="h-3 w-3" />
                          {statusBadge.label}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <CalendarIcon className="h-3 w-3" />
                        {new Date(a.data).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                      </div>
                      {isAdmin && status === "pendente" && (
                        <>
                          <Button size="icon" variant="ghost" className="h-6 w-6 text-emerald-600 hover:text-emerald-700" title="Aprovar" onClick={() => handleApprove(a.id)}>
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive hover:text-destructive" title="Rejeitar" onClick={() => handleReject(a.id)}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                      {canEdit && (
                        <AgendaFormDialog evento={a} trigger={<Button size="icon" variant="ghost" className="h-6 w-6"><Pencil className="h-3 w-3" /></Button>} />
                      )}
                      {isAdmin && (
                        <DeleteConfirmDialog title="Excluir Evento" description="Deseja excluir este evento da agenda? Esta ação não pode ser desfeita." onConfirm={() => handleDelete(a.id)} />
                      )}
                    </div>
                  </div>

                  {view === "all" && hasConjunta && (
                    <div
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium mb-2"
                      style={{ backgroundColor: `${ownerColor}20`, color: ownerColor, border: `1px solid ${ownerColor}40` }}
                    >
                      <User className="h-3 w-3" />
                      {ownerName}{isMine ? " (você)" : ""}
                    </div>
                  )}

                  <h3 className="font-semibold text-sm mb-2">{a.evento}</h3>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                    <MapPin className="h-3 w-3" />
                    {cidadeMap.get(a.cidade_id)?.nome}
                  </div>
                  {endereco && (
                    <p className="text-xs text-muted-foreground mb-1 pl-4">{endereco}</p>
                  )}
                  {ev.local_referencia && (
                    <p className="text-xs text-muted-foreground mb-1 pl-4 italic">Ref: {ev.local_referencia}</p>
                  )}
                  {ev.finalidade && (
                    <div className="flex items-start gap-1 text-xs text-muted-foreground mb-1">
                      <Target className="h-3 w-3 mt-0.5 shrink-0" />
                      <span>{ev.finalidade}</span>
                    </div>
                  )}
                  {a.responsavel && <p className="text-xs text-muted-foreground">Responsável: {a.responsavel}</p>}
                  {ev.observacoes && <p className="text-xs text-muted-foreground mt-1 italic">{ev.observacoes}</p>}
                </CardContent>
              </Card>
            );
          })}
          {dayAgenda.length === 0 && (
            <div className="col-span-full text-center text-muted-foreground py-8 border border-dashed rounded-lg">
              {selectedDate
                ? `Nenhum evento em ${selectedDate.toLocaleDateString('pt-BR')}`
                : "Nenhum evento na agenda"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
