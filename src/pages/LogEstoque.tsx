import { PageHeader } from "@/components/logistics/PageHeader";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Package, ArrowDownCircle, ArrowUpCircle, Search, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useState } from "react";
import { exportTablePdf, exportTableExcel } from "@/lib/exportPdf";
import { useIsMobile } from "@/hooks/use-mobile";

export default function LogEstoque() {
  const [search, setSearch] = useState("");
  const isMobile = useIsMobile();

  const { data: materials = [], isLoading } = useQuery({
    queryKey: ["log-materials"],
    queryFn: async () => {
      const { data, error } = await supabase.from("materials" as any).select("*").order("name");
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: movements = [] } = useQuery({
    queryKey: ["log-movements"],
    queryFn: async () => {
      const { data, error } = await supabase.from("movements" as any).select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const movementSummary = new Map<string, { entradas: number; saidas: number; devolucoes: number }>();
  movements.forEach((m: any) => {
    const existing = movementSummary.get(m.material_id) || { entradas: 0, saidas: 0, devolucoes: 0 };
    if (m.type === "Entrada") existing.entradas += m.quantity;
    else if (m.type === "Saída") existing.saidas += m.quantity;
    else if (m.type === "Devolução") existing.devolucoes += m.quantity;
    movementSummary.set(m.material_id, existing);
  });

  const filtered = materials.filter((m: any) =>
    !search || m.name?.toLowerCase().includes(search.toLowerCase()) || m.type?.toLowerCase().includes(search.toLowerCase())
  );

  const totalStock = filtered.reduce((s: number, m: any) => s + Math.max(0, m.available_qty), 0);
  const totalDistributed = filtered.reduce((s: number, m: any) => s + m.distributed_qty, 0);
  const totalItems = filtered.reduce((s: number, m: any) => s + m.total_qty, 0);

  const stockHeaders = ["Material", "Categoria", "Cadastrado", "Entradas", "Saídas", "Devoluções", "Estoque Atual", "Status"];
  const stockRows = () => filtered.map((m: any) => {
    const summary = movementSummary.get(m.id) || { entradas: 0, saidas: 0, devolucoes: 0 };
    return [m.name, m.type, m.total_qty.toString(), summary.entradas.toString(), summary.saidas.toString(), summary.devolucoes.toString(), m.available_qty.toString(), m.status];
  });

  const handleExportPdf = () => exportTablePdf("Estoque Geral", stockHeaders, stockRows());
  const handleExportExcel = () => exportTableExcel("Estoque Geral", stockHeaders, stockRows());

  return (
    <div className="space-y-4 sm:space-y-6 max-w-7xl">
      <PageHeader title="Estoque Geral" description="Controle completo de entradas, saídas e saldo de materiais">
        <div className="flex gap-2">
          <Button variant="outline" size={isMobile ? "sm" : "default"} className="gap-2" onClick={handleExportPdf}>
            <Download className="w-4 h-4" /> PDF
          </Button>
          <Button variant="outline" size={isMobile ? "sm" : "default"} className="gap-2" onClick={handleExportExcel}>
            <Download className="w-4 h-4" /> Excel
          </Button>
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-card border border-border rounded-xl p-4 sm:p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-1 sm:mb-2">
            <Package className="w-4 h-4 text-primary" />
            <h3 className="text-xs sm:text-sm font-semibold text-foreground">Total Cadastrado</h3>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-foreground">{totalItems.toLocaleString("pt-BR")}</p>
          <p className="text-xs text-muted-foreground mt-0.5">unidades cadastradas</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 sm:p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-1 sm:mb-2">
            <ArrowUpCircle className="w-4 h-4 text-destructive" />
            <h3 className="text-xs sm:text-sm font-semibold text-foreground">Total Distribuído</h3>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-foreground">{totalDistributed.toLocaleString("pt-BR")}</p>
          <p className="text-xs text-muted-foreground mt-0.5">unidades distribuídas</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 sm:p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-1 sm:mb-2">
            <ArrowDownCircle className="w-4 h-4 text-emerald-500" />
            <h3 className="text-xs sm:text-sm font-semibold text-foreground">Em Estoque</h3>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-foreground">{totalStock.toLocaleString("pt-BR")}</p>
          <p className="text-xs text-muted-foreground mt-0.5">unidades disponíveis</p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar material..." className="pl-10" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground"><p className="text-sm">Carregando...</p></div>
      ) : (
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left px-5 py-3 text-xs text-muted-foreground font-medium">Material</th>
                  <th className="text-center px-5 py-3 text-xs text-muted-foreground font-medium">Cadastrado</th>
                  <th className="text-center px-5 py-3 text-xs text-muted-foreground font-medium">Entradas</th>
                  <th className="text-center px-5 py-3 text-xs text-muted-foreground font-medium">Saídas</th>
                  <th className="text-center px-5 py-3 text-xs text-muted-foreground font-medium">Devoluções</th>
                  <th className="text-center px-5 py-3 text-xs text-muted-foreground font-medium">Estoque Atual</th>
                  <th className="text-center px-5 py-3 text-xs text-muted-foreground font-medium">Ocupação</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((mat: any) => {
                  const summary = movementSummary.get(mat.id) || { entradas: 0, saidas: 0, devolucoes: 0 };
                  const pct = mat.total_qty > 0 ? Math.max(0, (mat.available_qty / mat.total_qty) * 100) : 0;
                  return (
                    <tr key={mat.id} className="border-t border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3.5"><div className="flex items-center gap-2"><Package className="w-4 h-4 text-muted-foreground shrink-0" /><span className="font-medium text-foreground">{mat.name}</span></div></td>
                      <td className="px-5 py-3.5 text-center text-muted-foreground">{mat.total_qty?.toLocaleString("pt-BR")}</td>
                      <td className="px-5 py-3.5 text-center"><span className="text-emerald-600 font-medium">{summary.entradas > 0 ? `+${summary.entradas.toLocaleString("pt-BR")}` : "—"}</span></td>
                      <td className="px-5 py-3.5 text-center"><span className="text-destructive font-medium">{summary.saidas > 0 ? `-${summary.saidas.toLocaleString("pt-BR")}` : "—"}</span></td>
                      <td className="px-5 py-3.5 text-center"><span className="text-muted-foreground">{summary.devolucoes > 0 ? `+${summary.devolucoes.toLocaleString("pt-BR")}` : "—"}</span></td>
                      <td className="px-5 py-3.5 text-center font-bold text-foreground">{mat.available_qty?.toLocaleString("pt-BR")}</td>
                      <td className="px-5 py-3.5"><div className="w-20"><Progress value={Math.max(0, pct)} className="h-1.5" /><span className="text-[10px] text-muted-foreground">{Math.round(pct)}%</span></div></td>
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
