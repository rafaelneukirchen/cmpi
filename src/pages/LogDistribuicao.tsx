import { useState, useMemo } from "react";
import { PageHeader } from "@/components/logistics/PageHeader";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, ArrowDownCircle, ArrowUpCircle, RotateCcw, CheckCircle2, Truck, PackageCheck, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MovementFormDialog } from "@/components/logistics/MovementFormDialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { DeleteConfirmDialog } from "@/components/logistics/DeleteConfirmDialog";
import { useToast } from "@/hooks/use-toast";
import { logAudit } from "@/lib/auditLog";
import { useAuth } from "@/hooks/useAuth";


const typeIcons: Record<string, any> = { Entrada: ArrowDownCircle, Saída: ArrowUpCircle, Devolução: RotateCcw };
const typeColors: Record<string, string> = { Entrada: "text-emerald-600", Saída: "text-destructive", Devolução: "text-muted-foreground" };
const statusColors: Record<string, string> = { Separado: "bg-amber-500/15 text-amber-600", "Em Trânsito": "bg-primary/15 text-primary", Confirmado: "bg-emerald-500/15 text-emerald-600" };
const statusIcons: Record<string, any> = { Separado: PackageCheck, "Em Trânsito": Truck, Confirmado: CheckCircle2 };
const movementTypes = ["Entrada", "Saída", "Devolução"] as const;
const movementStatuses = ["Separado", "Em Trânsito", "Confirmado"] as const;

export default function LogDistribuicao() {
  const { userRole } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const canEdit = userRole === "admin" || userRole === "coordenador_estadual" || userRole === "coordenador_regional";
  const canDelete = userRole === "admin";

  const { data: movements = [], isLoading } = useQuery({
    queryKey: ["log-movements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("movements")
        .select("*, materials(name), logistics_profiles(full_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const handleStatusChange = async (movId: string, newStatus: string) => {
    try {
      const { error } = await supabase.from("movements").update({ status: newStatus } as any).eq("id", movId);
      if (error) throw error;
      await logAudit("UPDATE", "movements", movId, { status: newStatus });
      queryClient.invalidateQueries({ queryKey: ["log-movements"] });
      toast({ title: `Status atualizado para "${newStatus}"` });
    } catch (err: any) {
      toast({ title: "Erro ao atualizar status", description: err.message, variant: "destructive" });
    }
  };

  const deleteMovement = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("movements").delete().eq("id", id);
      if (error) throw error;
      await logAudit("DELETE", "movements", id, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["log-movements"] });
      queryClient.invalidateQueries({ queryKey: ["log-materials"] });
      queryClient.invalidateQueries({ queryKey: ["log-dashboard"] });
      toast({ title: "Movimentação excluída!" });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao excluir", description: err.message, variant: "destructive" });
    },
  });

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  const hasActiveFilter = filterType !== "all" || filterStatus !== "all" || filterDateFrom || filterDateTo;

  const clearFilters = () => {
    setFilterType("all");
    setFilterStatus("all");
    setFilterDateFrom("");
    setFilterDateTo("");
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return movements.filter((m: any) => {
      const matchesText = !q ||
        (m.materials?.name || "").toLowerCase().includes(q) ||
        (m.leader_name || "").toLowerCase().includes(q) ||
        (m.coordinator_name || "").toLowerCase().includes(q) ||
        (m.city || "").toLowerCase().includes(q) ||
        (m.logistics_profiles?.full_name || "").toLowerCase().includes(q);
      const matchesType = filterType === "all" || m.type === filterType;
      const matchesStatus = filterStatus === "all" || m.status === filterStatus;
      const movDate = m.created_at ? new Date(m.created_at).toISOString().slice(0, 10) : "";
      const matchesFrom = !filterDateFrom || movDate >= filterDateFrom;
      const matchesTo = !filterDateTo || movDate <= filterDateTo;
      return matchesText && matchesType && matchesStatus && matchesFrom && matchesTo;
    });
  }, [movements, search, filterType, filterStatus, filterDateFrom, filterDateTo]);

  return (
    <div className="space-y-4 sm:space-y-6 max-w-7xl">
      <PageHeader title="Distribuição" description="Histórico de movimentações e entregas de materiais">
        <MovementFormDialog />
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-sm flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por material, liderança, coord. ou cidade..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <NativeSelect
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="w-full sm:w-[150px] h-10 text-sm"
          options={[
            { value: "all", label: "Todos os Tipos" },
            ...movementTypes.map(t => ({ value: t, label: t })),
          ]}
        />
        <NativeSelect
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="w-full sm:w-[150px] h-10 text-sm"
          options={[
            { value: "all", label: "Todos os Status" },
            ...movementStatuses.map(s => ({ value: s, label: s })),
          ]}
        />
        <Input type="date" className="w-full sm:w-[150px] h-10 text-sm" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} />
        <span className="text-xs text-muted-foreground hidden sm:inline">até</span>
        <Input type="date" className="w-full sm:w-[150px] h-10 text-sm" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} />
        {hasActiveFilter && (
          <Button variant="ghost" size="sm" className="h-10 gap-1 text-sm" onClick={clearFilters}>
            <X className="w-3 h-3" /> Limpar
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground"><p className="text-sm">Carregando...</p></div>
      ) : (
        <div className="space-y-3">
          {filtered.map((mov: any, i: number) => {
            const Icon = typeIcons[mov.type] || RotateCcw;
            const StatusIcon = statusIcons[mov.status] || CheckCircle2;
            return (
              <div key={mov.id} className="bg-card border border-border rounded-xl p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center bg-muted shrink-0 ${typeColors[mov.type] || ""}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-semibold text-foreground">{mov.materials?.name || "Material"}</h4>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${mov.type === "Entrada" ? "bg-emerald-500/15 text-emerald-600" : "bg-destructive/15 text-destructive"}`}>{mov.type}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium inline-flex items-center gap-1 ${statusColors[mov.status] || "bg-muted text-muted-foreground"}`}>
                        <StatusIcon className="w-3 h-3" />{mov.status}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {mov.quantity?.toLocaleString("pt-BR")} unidades
                      {mov.leader_name && <> • <span className="font-medium text-foreground">Liderança:</span> {mov.leader_name}</>}
                      {mov.coordinator_name && <> • <span className="font-medium text-foreground">Coord:</span> {mov.coordinator_name}</>}
                    </p>
                    {mov.notes && <p className="text-xs text-muted-foreground/70 mt-0.5 italic">{mov.notes}</p>}
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      {mov.city && <div className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="w-3 h-3" />{mov.city}</div>}
                      <p className="text-xs text-muted-foreground">{new Date(mov.created_at).toLocaleDateString("pt-BR")}</p>
                    </div>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {canEdit && mov.status !== "Confirmado" && (
                        <NativeSelect
                          value={mov.status}
                          onChange={e => handleStatusChange(mov.id, e.target.value)}
                          className="h-8 text-xs w-32"
                          options={movementStatuses.map(s => ({ value: s, label: s }))}
                        />
                      )}
                      {canDelete && (
                        <DeleteConfirmDialog title="Excluir Movimentação" description="Tem certeza? O estoque NÃO será revertido automaticamente." onConfirm={() => deleteMovement.mutate(mov.id)} />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground"><p className="text-sm">Nenhuma movimentação encontrada.</p></div>
      )}
    </div>
  );
}
