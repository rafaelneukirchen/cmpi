import { useState } from "react";
import { PageHeader } from "@/components/logistics/PageHeader";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Search, Phone, MapPin, Download, Home, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PersonFormDialog } from "@/components/logistics/PersonFormDialog";
import { DeleteConfirmDialog } from "@/components/logistics/DeleteConfirmDialog";
import { SmartFilters } from "@/components/logistics/SmartFilters";
import { exportTablePdf, exportTableExcel } from "@/lib/exportPdf";
import { useToast } from "@/hooks/use-toast";
import { logAudit } from "@/lib/auditLog";
import { useAuth } from "@/hooks/useAuth";

const statusColors: Record<string, string> = {
  Ativo: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  Inativo: "bg-muted text-muted-foreground border-border",
  Bloqueado: "bg-destructive/15 text-destructive border-destructive/30",
};

export default function LogPessoas() {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { userRole } = useAuth();
  const canEdit = userRole === "admin" || userRole === "coordenador_estadual";
  const canDelete = userRole === "admin";

  const { data: people = [], isLoading } = useQuery({
    queryKey: ["log-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("logistics_profiles" as any).select("*").order("full_name");
      if (error) throw error;
      return data as any[];
    },
  });

  const deletePerson = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("logistics_profiles" as any).delete().eq("id", id);
      if (error) throw error;
      await logAudit("DELETE", "logistics_profiles", id, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["log-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["log-dashboard"] });
      toast({ title: "Pessoa excluída com sucesso!" });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao excluir", description: err.message, variant: "destructive" });
    },
  });

  const updateFilter = (key: string, value: string) => setFilters(prev => ({ ...prev, [key]: value }));
  const clearFilters = () => setFilters({});

  const filtered = people.filter((p: any) => {
    const matchSearch = !search || p.full_name?.toLowerCase().includes(search.toLowerCase()) || p.cpf?.includes(search) || p.city?.toLowerCase().includes(search.toLowerCase());
    const matchRegion = !filters.region || filters.region === "all" || p.region === filters.region;
    const matchMgmt = !filters.management || filters.management === "all" || p.management === filters.management;
    const matchStatus = !filters.status || filters.status === "all" || p.status === filters.status;
    return matchSearch && matchRegion && matchMgmt && matchStatus;
  });

  const exportHeaders = ["Nome", "CPF", "Telefone", "Cidade", "Bairro", "Coordenador", "Status"];
  const exportRows = () => filtered.map((p: any) => [p.full_name, p.cpf || "-", p.phone || "-", p.city || "-", p.neighborhood || "-", p.management || "-", p.status]);

  const handleExportPdf = () => exportTablePdf("Cadastro de Pessoas", exportHeaders, exportRows());
  const handleExportExcel = () => exportTableExcel("Cadastro de Pessoas", exportHeaders, exportRows());

  return (
    <div className="space-y-6 max-w-7xl">
      <PageHeader title="Cadastro de Pessoas" description="Gestão de colaboradores da campanha">
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={handleExportPdf}><Download className="w-4 h-4" /> PDF</Button>
          <Button variant="outline" className="gap-2" onClick={handleExportExcel}><Download className="w-4 h-4" /> Excel</Button>
          {canEdit && <PersonFormDialog />}
        </div>
      </PageHeader>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar por nome, CPF ou cidade..." className="pl-10" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <SmartFilters filters={filters} onChange={updateFilter} onClear={clearFilters} config={{ showRegion: true, showManagement: true, showStatus: true, statusOptions: ["Ativo", "Inativo", "Bloqueado"] }} />

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground"><p className="text-sm">Carregando...</p></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((person: any) => (
            <div key={person.id} className="bg-card border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                    <span className="text-sm font-bold text-primary-foreground">{person.full_name?.split(" ").map((n: string) => n[0]).slice(0, 2).join("")}</span>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{person.full_name}</h3>
                    <p className="text-xs text-muted-foreground">{person.management || "Sem coordenador"}</p>
                  </div>
                </div>
                {canEdit && (
                  <div className="flex items-center gap-0.5">
                    <PersonFormDialog editData={person} trigger={<Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground"><Pencil className="w-3.5 h-3.5" /></Button>} />
                    {canDelete && <DeleteConfirmDialog title="Excluir Pessoa" description={`Excluir "${person.full_name}"?`} onConfirm={() => deletePerson.mutate(person.id)} />}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 mb-3">
                <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${statusColors[person.status] || "bg-muted text-muted-foreground border-border"}`}>{person.status}</span>
              </div>
              <div className="space-y-1.5 text-xs text-muted-foreground">
                {person.phone && <div className="flex items-center gap-2"><Phone className="w-3 h-3" />{person.phone}</div>}
                {person.city && <div className="flex items-center gap-2"><MapPin className="w-3 h-3" />{person.city} {person.region ? `— ${person.region}` : ""}</div>}
                {person.neighborhood && <div className="flex items-center gap-2"><Home className="w-3 h-3" />{person.neighborhood}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground"><p className="text-sm">Nenhuma pessoa encontrada.</p></div>
      )}
    </div>
  );
}
