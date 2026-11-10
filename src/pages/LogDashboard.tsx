import { Users, Package, DollarSign, TrendingUp, AlertTriangle, MapPin, ArrowUpRight } from "lucide-react";
import { LogStatCard } from "@/components/logistics/LogStatCard";
import { PageHeader } from "@/components/logistics/PageHeader";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis } from "recharts";
import { useIsMobile } from "@/hooks/use-mobile";

export default function LogDashboard() {
  const isMobile = useIsMobile();

  const { data } = useQuery({
    queryKey: ["log-dashboard"],
    queryFn: async () => {
      const [profilesRes, materialsRes, movementsRes] = await Promise.all([
        supabase.from("logistics_profiles" as any).select("*"),
        supabase.from("materials" as any).select("*"),
        supabase.from("movements" as any).select("*, materials(name), logistics_profiles(full_name)").order("created_at", { ascending: false }).limit(5),
      ]);
      return {
        profiles: (profilesRes.data || []) as any[],
        materials: (materialsRes.data || []) as any[],
        movements: (movementsRes.data || []) as any[],
      };
    },
  });

  const profiles = data?.profiles || [];
  const materials = data?.materials || [];
  const movements = data?.movements || [];

  const totalInvestment = materials.reduce((sum: number, m: any) => sum + (m.total_price || 0), 0);
  const lowStockItems = materials.filter((m: any) => m.total_qty > 0 && m.available_qty / m.total_qty < 0.15);

  const mgmtMap = new Map<string, number>();
  materials.forEach((m: any) => {
    const key = m.management || "Sem coordenador";
    mgmtMap.set(key, (mgmtMap.get(key) || 0) + (m.total_price || 0));
  });
  const pieColors = ["hsl(var(--primary))", "hsl(45, 85%, 50%)", "hsl(152, 60%, 40%)", "hsl(280, 50%, 45%)", "hsl(0, 72%, 51%)"];
  const pieData = Array.from(mgmtMap.entries()).map(([name, value], i) => ({ name, value, color: pieColors[i % pieColors.length] }));

  const cityMap = new Map<string, number>();
  materials.forEach((m: any) => {
    if (m.city) cityMap.set(m.city, (cityMap.get(m.city) || 0) + (m.total_price || 0));
  });
  const cityData = Array.from(cityMap.entries()).map(([city, total]) => ({ city, total })).sort((a, b) => b.total - a.total).slice(0, 5);

  return (
    <div className="space-y-4 sm:space-y-6 max-w-7xl">
      <PageHeader title="Painel Logístico" description="Visão geral de materiais, pessoas e movimentações" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <LogStatCard title="Total de Pessoas" value={profiles.length} subtitle={`${profiles.filter((p: any) => p.status === "Ativo").length} ativos`} icon={Users} variant="primary" />
        <LogStatCard title="Materiais" value={materials.length} subtitle={`${lowStockItems.length} estoque baixo`} icon={Package} />
        <LogStatCard title="Investimento" value={`R$ ${(totalInvestment / 1000).toFixed(0)}k`} subtitle="Todos os materiais" icon={DollarSign} variant="accent" />
        <LogStatCard title="Movimentações" value={movements.length} subtitle="Últimas registradas" icon={TrendingUp} />
      </div>

      {lowStockItems.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <span className="text-xs sm:text-sm font-semibold text-amber-600">Alertas de Estoque Baixo</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {lowStockItems.map((item: any) => (
              <span key={item.id} className="text-xs bg-amber-500/15 text-amber-700 px-2.5 py-1 rounded-full font-medium">
                {item.name} — {item.available_qty} restantes
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
        {pieData.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-4 sm:p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-foreground mb-4">Investimento por Coordenador</h3>
            <div className="h-48 sm:h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={isMobile ? 40 : 55} outerRadius={isMobile ? 65 : 90} paddingAngle={3} dataKey="value">
                    {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => `R$ ${v.toLocaleString("pt-BR")}`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-2 sm:gap-3 mt-2">
              {pieData.map((entry, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                  <span className="text-[10px] sm:text-xs text-muted-foreground">{entry.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {cityData.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-4 sm:p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-foreground mb-4">Investimento por Cidade</h3>
            <div className="h-48 sm:h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cityData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="city" tick={{ fontSize: isMobile ? 10 : 12 }} className="fill-muted-foreground" />
                  <YAxis tick={{ fontSize: isMobile ? 10 : 12 }} className="fill-muted-foreground" tickFormatter={v => `${v / 1000}k`} />
                  <Tooltip formatter={(v: number) => `R$ ${v.toLocaleString("pt-BR")}`} />
                  <Bar dataKey="total" className="fill-primary" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      <div className="bg-card border border-border rounded-xl p-4 sm:p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground">Últimas Movimentações</h3>
          <a href="/log-distribuicao" className="text-xs text-primary flex items-center gap-1 hover:underline">
            Ver todos <ArrowUpRight className="w-3 h-3" />
          </a>
        </div>
        {movements.length > 0 ? (
          <div className="space-y-3">
            {movements.map((mov: any) => (
              <div key={mov.id} className="flex items-start gap-3 pb-3 border-b border-border/50 last:border-0 last:pb-0">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-foreground">{mov.materials?.name || "-"}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${mov.type === "Entrada" ? "bg-emerald-500/15 text-emerald-600" : mov.type === "Saída" ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground"}`}>
                      {mov.type}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {mov.quantity?.toLocaleString("pt-BR")} un. • {mov.logistics_profiles?.full_name || "-"}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                    {mov.city && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{mov.city}</span>}
                    <span>{new Date(mov.created_at).toLocaleDateString("pt-BR")}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhuma movimentação registrada ainda.</p>
        )}
      </div>
    </div>
  );
}
