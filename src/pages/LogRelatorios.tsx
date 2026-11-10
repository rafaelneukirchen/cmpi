import { PageHeader } from "@/components/logistics/PageHeader";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Download, FileText, BarChart3, DollarSign, MapPin, Users, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportReportPdf, exportReportExcel } from "@/lib/exportPdf";

export default function LogRelatorios() {
  const { data: materials = [] } = useQuery({
    queryKey: ["log-materials"],
    queryFn: async () => {
      const { data, error } = await supabase.from("materials" as any).select("*").order("name");
      if (error) throw error;
      return data as any[];
    },
  });

  const totalInvestment = materials.reduce((sum: number, m: any) => sum + (m.total_price || 0), 0);
  const totalDistributed = materials.reduce((sum: number, m: any) => sum + m.distributed_qty, 0);
  const totalInStock = materials.reduce((sum: number, m: any) => sum + m.available_qty, 0);

  const mgmtMap = new Map<string, number>();
  materials.forEach((m: any) => {
    const key = m.management || "Sem coordenador";
    mgmtMap.set(key, (mgmtMap.get(key) || 0) + (m.total_price || 0));
  });

  const topDistributed = [...materials].filter((m: any) => m.distributed_qty > 0).sort((a: any, b: any) => b.distributed_qty - a.distributed_qty).slice(0, 4);

  const cityMap = new Map<string, number>();
  materials.forEach((m: any) => {
    if (m.city) cityMap.set(m.city, (cityMap.get(m.city) || 0) + (m.total_price || 0));
  });

  const topCost = [...materials].sort((a: any, b: any) => (b.total_price || 0) - (a.total_price || 0)).slice(0, 4);

  const reportSections = [
    { title: "Investimento por Coordenador", icon: Users, items: Array.from(mgmtMap.entries()).map(([label, v]) => ({ label, value: `R$ ${v.toLocaleString("pt-BR")}` })) },
    { title: "Materiais Distribuídos (Saídas)", icon: BarChart3, items: topDistributed.map((m: any) => ({ label: m.name, value: `${m.distributed_qty.toLocaleString("pt-BR")} unid.` })) },
    { title: "Investimento por Cidade", icon: MapPin, items: Array.from(cityMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([label, v]) => ({ label, value: `R$ ${v.toLocaleString("pt-BR")}` })) },
    { title: "Materiais com Maior Custo", icon: DollarSign, items: topCost.map((m: any) => ({ label: m.name, value: `R$ ${(m.total_price || 0).toLocaleString("pt-BR")}` })) },
  ];

  return (
    <div className="space-y-6 max-w-7xl">
      <PageHeader title="Relatórios Logísticos" description="Análises executivas de materiais e investimentos">
        <div className="flex gap-2">
          <Button className="gap-2" onClick={() => exportReportPdf(reportSections, totalInvestment)}><Download className="w-4 h-4" /> PDF</Button>
          <Button variant="outline" className="gap-2" onClick={() => exportReportExcel(reportSections, totalInvestment)}><Download className="w-4 h-4" /> Excel</Button>
        </div>
      </PageHeader>

      <div className="bg-primary text-primary-foreground rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-2">
          <FileText className="w-5 h-5" />
          <h2 className="text-lg font-bold">Custo Total da Campanha</h2>
        </div>
        <p className="text-3xl font-bold">R$ {totalInvestment.toLocaleString("pt-BR")}</p>
        <p className="text-sm opacity-80 mt-1">{materials.length} materiais cadastrados</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Package className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Estoque Disponível</h3>
          </div>
          <p className="text-2xl font-bold text-foreground">{totalInStock.toLocaleString("pt-BR")}</p>
          <p className="text-xs text-muted-foreground mt-1">unidades em estoque</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-4 h-4 text-destructive" />
            <h3 className="text-sm font-semibold text-foreground">Total Distribuído</h3>
          </div>
          <p className="text-2xl font-bold text-foreground">{totalDistributed.toLocaleString("pt-BR")}</p>
          <p className="text-xs text-muted-foreground mt-1">unidades distribuídas</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {reportSections.map((section, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <section.icon className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">{section.title}</h3>
            </div>
            <div className="space-y-2.5">
              {section.items.length > 0 ? section.items.map((item, j) => (
                <div key={j} className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{item.label}</span>
                  <span className="text-sm font-semibold text-foreground">{item.value}</span>
                </div>
              )) : (
                <p className="text-sm text-muted-foreground">Sem dados disponíveis</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
