import { useState } from "react";
import { PageHeader } from "@/components/logistics/PageHeader";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Search, Package, AlertTriangle, Download, Pencil, PackagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { MaterialFormDialog } from "@/components/logistics/MaterialFormDialog";
import { StockEntryDialog } from "@/components/logistics/StockEntryDialog";
import { DeleteConfirmDialog } from "@/components/logistics/DeleteConfirmDialog";
import { SmartFilters } from "@/components/logistics/SmartFilters";
import { exportTablePdf } from "@/lib/exportPdf";
import { useToast } from "@/hooks/use-toast";
import { logAudit } from "@/lib/auditLog";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";

const statusColors: Record<string, string> = {
  Disponível: "bg-emerald-500/15 text-emerald-600",
  "Em trânsito": "bg-amber-500/15 text-amber-600",
  Entregue: "bg-primary/10 text-primary",
  Esgotado: "bg-destructive/15 text-destructive",
};

export default function LogMateriais() {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { userRole } = useAuth();
  const canEdit = userRole === "admin" || userRole === "coordenador_estadual" || userRole === "operador_cadastro";
  const canDelete = userRole === "admin";
  const isMobile = useIsMobile();

  const { data: materials = [], isLoading } = useQuery({
    queryKey: ["log-materials"],
    queryFn: async () => {
      const { data, error } = await supabase.from("materials" as any).select("*").order("name");
      if (error) throw error;
      return data as any[];
    },
  });

  const deleteMaterial = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("materials" as any).delete().eq("id", id);
      if (error) throw error;
      await logAudit("DELETE", "materials", id, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["log-materials"] });
      queryClient.invalidateQueries({ queryKey: ["log-dashboard"] });
      toast({ title: "Material excluído com sucesso!" });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao excluir", description: err.message, variant: "destructive" });
    },
  });

  const updateFilter = (key: string, value: string) => setFilters(prev => ({ ...prev, [key]: value }));
  const clearFilters = () => setFilters({});

  const filtered = materials.filter((m: any) => {
    const matchSearch = !search || m.name?.toLowerCase().includes(search.toLowerCase()) || m.type?.toLowerCase().includes(search.toLowerCase()) || m.city?.toLowerCase().includes(search.toLowerCase());
    const matchMgmt = !filters.management || filters.management === "all" || m.management === filters.management;
    const matchType = !filters.type || filters.type === "all" || m.type === filters.type;
    const matchStatus = !filters.status || filters.status === "all" || m.status === filters.status;
    return matchSearch && matchMgmt && matchType && matchStatus;
  });

  const handleExportPdf = () => {
    exportTablePdf("Gestão de Materiais", ["Material", "Tipo", "Estoque", "Valor Total", "Coordenador", "Status"],
      filtered.map((m: any) => [m.name, m.type, `${m.available_qty}/${m.total_qty}`, `R$ ${(m.total_price || 0).toLocaleString("pt-BR")}`, m.management || "-", m.status])
    );
  };

  return (
    <div className="space-y-4 sm:space-y-6 max-w-7xl">
      <PageHeader title="Gestão de Materiais" description="Controle de estoque e distribuição de materiais da campanha">
        <div className="flex gap-2">
          <Button variant="outline" size={isMobile ? "sm" : "default"} className="gap-2" onClick={handleExportPdf}>
            <Download className="w-4 h-4" /> PDF
          </Button>
          {canEdit && <StockEntryDialog />}
          {canEdit && <MaterialFormDialog />}
        </div>
      </PageHeader>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar material, tipo ou cidade..." className="pl-10" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <SmartFilters filters={filters} onChange={updateFilter} onClear={clearFilters} config={{
        showManagement: true, showType: true, showStatus: true,
        statusOptions: ["Disponível", "Em trânsito", "Entregue", "Esgotado"],
      }} />

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground"><p className="text-sm">Carregando...</p></div>
      ) : isMobile ? (
        <div className="space-y-3">
          {filtered.map((mat: any) => {
            const pct = mat.total_qty > 0 ? (mat.available_qty / mat.total_qty) * 100 : 0;
            const isLow = pct < 15 && pct > 0;
            return (
              <div key={mat.id} className="bg-card border border-border rounded-xl p-4 shadow-sm">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium text-foreground text-sm">{mat.type}</span>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColors[mat.status] || "bg-muted text-muted-foreground"}`}>{mat.status}</span>
                </div>
                <div className="space-y-2 mb-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Estoque</span>
                    <div className="flex items-center gap-1">
                      <span>{mat.available_qty?.toLocaleString("pt-BR")} / {mat.total_qty?.toLocaleString("pt-BR")}</span>
                      {isLow && <AlertTriangle className="w-3 h-3 text-amber-500" />}
                    </div>
                  </div>
                  <Progress value={pct} className="h-1.5" />
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Valor Total</span>
                    <span className="font-medium text-foreground">R$ {(mat.total_price || 0).toLocaleString("pt-BR")}</span>
                  </div>
                </div>
                {canEdit && (
                  <div className="flex items-center gap-1 pt-2 border-t border-border">
                    <StockEntryDialog material={mat} trigger={<Button variant="ghost" size="sm" className="h-8 gap-1 text-xs text-muted-foreground"><PackagePlus className="w-3.5 h-3.5" /> Entrada</Button>} />
                    <MaterialFormDialog editData={mat} trigger={<Button variant="ghost" size="sm" className="h-8 gap-1 text-xs text-muted-foreground"><Pencil className="w-3.5 h-3.5" /> Editar</Button>} />
                    {canDelete && <DeleteConfirmDialog title="Excluir Material" description={`Excluir "${mat.name}"?`} onConfirm={() => deleteMaterial.mutate(mat.id)} />}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left px-5 py-3 text-xs text-muted-foreground font-medium">Descrição</th>
                  <th className="text-left px-5 py-3 text-xs text-muted-foreground font-medium">Estoque</th>
                  <th className="text-left px-5 py-3 text-xs text-muted-foreground font-medium">Valor Total</th>
                  <th className="text-left px-5 py-3 text-xs text-muted-foreground font-medium">Coordenador</th>
                  <th className="text-left px-5 py-3 text-xs text-muted-foreground font-medium">Status</th>
                  {canEdit && <th className="text-center px-5 py-3 text-xs text-muted-foreground font-medium">Ações</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((mat: any) => {
                  const pct = mat.total_qty > 0 ? (mat.available_qty / mat.total_qty) * 100 : 0;
                  const isLow = pct < 15 && pct > 0;
                  return (
                    <tr key={mat.id} className="border-t border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium text-foreground">{mat.type}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">{mat.available_qty?.toLocaleString("pt-BR")} / {mat.total_qty?.toLocaleString("pt-BR")}</span>
                            {isLow && <AlertTriangle className="w-3 h-3 text-amber-500" />}
                          </div>
                          <Progress value={pct} className="h-1.5" />
                        </div>
                      </td>
                      <td className="px-5 py-3.5 font-medium text-foreground">R$ {(mat.total_price || 0).toLocaleString("pt-BR")}</td>
                      <td className="px-5 py-3.5 text-muted-foreground text-xs">{mat.management || "-"}</td>
                      <td className="px-5 py-3.5">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColors[mat.status] || "bg-muted text-muted-foreground"}`}>{mat.status}</span>
                      </td>
                      {canEdit && (
                        <td className="px-5 py-3.5">
                          <div className="flex items-center justify-center gap-1">
                            <StockEntryDialog material={mat} trigger={<Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" title="Entrada de estoque"><PackagePlus className="w-4 h-4" /></Button>} />
                            <MaterialFormDialog editData={mat} trigger={<Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground"><Pencil className="w-4 h-4" /></Button>} />
                            {canDelete && <DeleteConfirmDialog title="Excluir Material" description={`Excluir "${mat.name}"?`} onConfirm={() => deleteMaterial.mutate(mat.id)} />}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Nenhum material encontrado.</p>
        </div>
      )}
    </div>
  );
}
