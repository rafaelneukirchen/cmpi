import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { NativeSelect } from "@/components/ui/native-select";
import { TrendingUp, Loader2, LineChart as LineIcon } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

type Row = {
  id: string;
  created_at: string;
  captado_por_user_id: string | null;
  lideranca_id: string | null;
  tipo_captador: "lideranca" | "usuario";
};

type EquipeRow = { user_id: string; coordenador_user_id: string | null };
type ProfileRow = { user_id: string; nome: string | null };
type LiderancaRow = { id: string; nome: string | null };
type RoleRow = { user_id: string; role: string };

// ISO week start (Monday) as YYYY-MM-DD
function weekKey(dateStr: string): string {
  const d = new Date(dateStr);
  const day = (d.getUTCDay() + 6) % 7; // 0=Mon
  d.setUTCDate(d.getUTCDate() - day);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function weekLabel(iso: string) {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

// Distinct, deterministic palette
const PALETTE = [
  "#2563eb", "#dc2626", "#16a34a", "#ea580c", "#9333ea",
  "#0891b2", "#ca8a04", "#db2777", "#65a30d", "#7c3aed",
  "#0284c7", "#b91c1c",
];

type Mode = "liderancas" | "coordenadores" | "captadores";

export default function EvolucaoCaptacaoChart() {
  const [mode, setMode] = useState<Mode>("liderancas");
  const [weeks, setWeeks] = useState(12);
  const [topN, setTopN] = useState(8);

  const { data, isLoading } = useQuery({
    queryKey: ["captacao-evolucao-semanal"],
    queryFn: async () => {
      // Paginate eleitores_captados
      const pageSize = 1000;
      let from = 0;
      const all: Row[] = [];
      while (true) {
        const { data: chunk, error } = await supabase
          .from("eleitores_captados")
          .select("id, created_at, captado_por_user_id, lideranca_id, tipo_captador")
          .order("created_at", { ascending: false })
          .range(from, from + pageSize - 1);
        if (error) throw error;
        const rows = (chunk ?? []) as unknown as Row[];
        all.push(...rows);
        if (rows.length < pageSize) break;
        from += pageSize;
      }

      const [profilesRes, liderancasRes, equipeRes, rolesRes] = await Promise.all([
        supabase.from("profiles").select("user_id, nome"),
        supabase.from("liderancas").select("id, nome"),
        supabase.from("equipe_membros").select("user_id, coordenador_user_id"),
        supabase
          .from("user_roles")
          .select("user_id, role")
          .in("role", ["coordenador_estadual", "coordenador_regional"]),
      ]);

      return {
        rows: all,
        profiles: (profilesRes.data ?? []) as ProfileRow[],
        liderancas: (liderancasRes.data ?? []) as LiderancaRow[],
        equipe: (equipeRes.data ?? []) as EquipeRow[],
        roles: (rolesRes.data ?? []) as RoleRow[],
      };
    },
  });

  const { chartData, series } = useMemo(() => {
    if (!data) return { chartData: [] as any[], series: [] as { key: string; nome: string; total: number }[] };

    const profileNome = new Map(data.profiles.map(p => [p.user_id, p.nome || "Usuário"]));
    const liderancaNome = new Map(data.liderancas.map(l => [l.id, l.nome || "Liderança"]));
    const memberToCoord = new Map(data.equipe.map(e => [e.user_id, e.coordenador_user_id]));
    const coordIds = new Set<string>([
      ...data.roles.map(r => r.user_id),
      ...data.equipe.map(e => e.coordenador_user_id).filter(Boolean) as string[],
    ]);

    // Build last N weeks list
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const todayDay = (today.getUTCDay() + 6) % 7;
    today.setUTCDate(today.getUTCDate() - todayDay);
    const weekList: string[] = [];
    for (let i = weeks - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() - i * 7);
      weekList.push(d.toISOString().slice(0, 10));
    }
    const weekSet = new Set(weekList);

    // counts[entityKey][weekKey] = number
    const counts = new Map<string, Map<string, number>>();
    const nameMap = new Map<string, string>();

    for (const r of data.rows) {
      const wk = weekKey(r.created_at);
      if (!weekSet.has(wk)) continue;

      let key: string | null = null;
      let nome: string | null = null;

      if (mode === "liderancas") {
        if (r.tipo_captador !== "lideranca" || !r.lideranca_id) continue;
        key = `l:${r.lideranca_id}`;
        nome = liderancaNome.get(r.lideranca_id) || "Liderança";
      } else if (mode === "captadores") {
        if (r.tipo_captador !== "usuario" || !r.captado_por_user_id) continue;
        key = `u:${r.captado_por_user_id}`;
        nome = profileNome.get(r.captado_por_user_id) || "Usuário";
      } else {
        // coordenadores: roll up captacoes feitas por membros + próprio coord
        if (r.tipo_captador !== "usuario" || !r.captado_por_user_id) continue;
        let coordId: string | null = null;
        if (coordIds.has(r.captado_por_user_id)) coordId = r.captado_por_user_id;
        else coordId = memberToCoord.get(r.captado_por_user_id) || null;
        if (!coordId) continue;
        key = `c:${coordId}`;
        nome = profileNome.get(coordId) || "Coordenação";
      }

      if (!key) continue;
      nameMap.set(key, nome!);
      let m = counts.get(key);
      if (!m) { m = new Map(); counts.set(key, m); }
      m.set(wk, (m.get(wk) || 0) + 1);
    }

    // total per entity to pick topN
    const totals = Array.from(counts.entries()).map(([key, m]) => {
      let t = 0;
      for (const v of m.values()) t += v;
      return { key, nome: nameMap.get(key) || "—", total: t, weeks: m };
    });
    totals.sort((a, b) => b.total - a.total);
    const top = totals.slice(0, topN);

    const chart = weekList.map(wk => {
      const row: any = { week: wk, label: weekLabel(wk) };
      for (const t of top) row[t.key] = t.weeks.get(wk) || 0;
      return row;
    });

    return {
      chartData: chart,
      series: top.map(t => ({ key: t.key, nome: t.nome, total: t.total })),
    };
  }, [data, mode, weeks, topN]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" /> Evolução semanal de captação
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
          <TabsList className="grid w-full grid-cols-3 mb-3">
            <TabsTrigger value="liderancas">Lideranças</TabsTrigger>
            <TabsTrigger value="coordenadores">Coordenadores</TabsTrigger>
            <TabsTrigger value="captadores">Captadores (usuários)</TabsTrigger>
          </TabsList>

          <div className="flex flex-wrap gap-2 mb-3 items-end">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-muted-foreground">Período (semanas)</label>
              <NativeSelect
                value={String(weeks)}
                onChange={(e) => setWeeks(Number(e.target.value))}
                className="h-8 w-32"
                options={[
                  { value: "4", label: "4 semanas" },
                  { value: "8", label: "8 semanas" },
                  { value: "12", label: "12 semanas" },
                  { value: "24", label: "24 semanas" },
                  { value: "52", label: "52 semanas" },
                ]}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-muted-foreground">Top</label>
              <NativeSelect
                value={String(topN)}
                onChange={(e) => setTopN(Number(e.target.value))}
                className="h-8 w-28"
                options={[
                  { value: "5", label: "Top 5" },
                  { value: "8", label: "Top 8" },
                  { value: "10", label: "Top 10" },
                  { value: "12", label: "Top 12" },
                ]}
              />
            </div>
          </div>

          <TabsContent value={mode} className="mt-0">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : series.length === 0 ? (
              <div className="text-center py-10 text-sm text-muted-foreground flex flex-col items-center gap-2">
                <LineIcon className="h-6 w-6 opacity-50" />
                Nenhuma captação no período selecionado.
              </div>
            ) : (
              <>
                <div className="h-[360px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" fontSize={11} stroke="hsl(var(--muted-foreground))" />
                      <YAxis allowDecimals={false} fontSize={11} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip
                        contentStyle={{
                          background: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                        formatter={(value: any, name: any) => {
                          const s = series.find((x) => x.key === name);
                          return [value, s?.nome || name];
                        }}
                        labelFormatter={(l) => `Semana de ${l}`}
                      />
                      <Legend
                        wrapperStyle={{ fontSize: 11 }}
                        formatter={(value: any) => {
                          const s = series.find((x) => x.key === value);
                          return s?.nome || value;
                        }}
                      />
                      {series.map((s, i) => (
                        <Line
                          key={s.key}
                          type="monotone"
                          dataKey={s.key}
                          stroke={PALETTE[i % PALETTE.length]}
                          strokeWidth={2}
                          dot={{ r: 2 }}
                          activeDot={{ r: 4 }}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-[11px] text-muted-foreground mt-2 text-center">
                  Mostrando top {series.length} por total de captação no período. Semanas iniciam na segunda-feira.
                </p>
              </>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
