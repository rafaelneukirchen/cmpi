import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, MapPin } from "lucide-react";
import type { CidadePrioridade } from "@/hooks/useCidadePrioridade";

const NIVEL_CONFIG = {
  critica: { label: "Crítica", color: "bg-destructive text-destructive-foreground", dot: "#dc2626" },
  alta: { label: "Alta", color: "bg-warning text-warning-foreground", dot: "#f59e0b" },
  media: { label: "Média", color: "bg-secondary text-secondary-foreground", dot: "#6b7280" },
  baixa: { label: "Baixa", color: "bg-muted text-muted-foreground", dot: "#9ca3af" },
};

interface Props {
  prioridades: CidadePrioridade[];
  onSelectCidade: (cidadeId: string) => void;
  maxItems?: number;
}

export default function PainelPrioridades({ prioridades, onSelectCidade, maxItems = 8 }: Props) {
  const criticas = prioridades.filter(p => p.nivel === 'critica').length;
  const altas = prioridades.filter(p => p.nivel === 'alta').length;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <CardTitle className="text-sm">Prioridades de Atuação</CardTitle>
        </div>
        <div className="flex gap-2 text-[10px] md:text-xs">
          {criticas > 0 && (
            <Badge variant="destructive" className="text-[10px]">{criticas} críticas</Badge>
          )}
          {altas > 0 && (
            <Badge variant="secondary" className="text-[10px]">{altas} altas</Badge>
          )}
          <span className="text-muted-foreground">{prioridades.length} cidades analisadas</span>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-[300px] overflow-y-auto">
          {prioridades.slice(0, maxItems).map((p) => {
            const cfg = NIVEL_CONFIG[p.nivel];
            return (
              <button
                key={p.cidadeId}
                className="w-full text-left px-3 py-2 hover:bg-accent border-b last:border-b-0 transition-colors"
                onClick={() => onSelectCidade(p.cidadeId)}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <MapPin className="h-3 w-3 shrink-0" style={{ color: cfg.dot }} />
                    <span className="font-medium text-xs truncate">{p.nome}</span>
                  </div>
                  <Badge className={`text-[9px] px-1.5 py-0 shrink-0 ${cfg.color}`}>
                    {cfg.label}
                  </Badge>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <Progress value={p.score} className="h-1.5 flex-1" />
                  <span className="text-[10px] text-muted-foreground w-6 text-right">{p.score}</span>
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {p.motivos.map((m, i) => (
                    <span key={i} className="text-[9px] text-muted-foreground bg-muted px-1 py-0.5 rounded">
                      {m}
                    </span>
                  ))}
                </div>
                {p.gap > 0 && (
                  <p className="text-[10px] text-destructive mt-0.5">
                    Gap: {p.gap.toLocaleString('pt-BR')} votos faltantes
                  </p>
                )}
              </button>
            );
          })}
          {prioridades.length === 0 && (
            <p className="px-3 py-4 text-center text-xs text-muted-foreground">Nenhuma cidade com prioridade identificada</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
