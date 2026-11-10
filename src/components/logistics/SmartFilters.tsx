import { NativeSelect } from "@/components/ui/native-select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Filter, X } from "lucide-react";
import { REGIONS, MATERIAL_TYPES } from "@/types/campaign";
import { useCoordenadores } from "@/hooks/useCoordenadores";

interface FilterConfig {
  showRegion?: boolean;
  showManagement?: boolean;
  showStatus?: boolean;
  showType?: boolean;
  showCity?: boolean;
  showPeriod?: boolean;
  statusOptions?: string[];
}

interface SmartFiltersProps {
  filters: Record<string, string>;
  onChange: (key: string, value: string) => void;
  onClear: () => void;
  config: FilterConfig;
}

export function SmartFilters({ filters, onChange, onClear, config }: SmartFiltersProps) {
  const hasActive = Object.values(filters).some(v => v && v !== "all");
  const { data: coordenadores = [] } = useCoordenadores();

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <Filter className="w-4 h-4 text-muted-foreground shrink-0" />

      {config.showRegion && (
        <NativeSelect
          value={filters.region || "all"}
          onChange={e => onChange("region", e.target.value)}
          className="w-full sm:w-[160px] h-9 text-xs"
          options={[
            { value: "all", label: "Todas as Regiões" },
            ...REGIONS.map(r => ({ value: r, label: r })),
          ]}
        />
      )}

      {config.showManagement && (
        <NativeSelect
          value={filters.management || "all"}
          onChange={e => onChange("management", e.target.value)}
          className="w-full sm:w-[180px] h-9 text-xs"
          options={[
            { value: "all", label: "Todos os Coordenadores" },
            ...coordenadores.map(c => ({ value: c.nome, label: c.nome })),
          ]}
        />
      )}

      {config.showType && (
        <NativeSelect
          value={filters.type || "all"}
          onChange={e => onChange("type", e.target.value)}
          className="w-full sm:w-[140px] h-9 text-xs"
          options={[
            { value: "all", label: "Todos os Tipos" },
            ...MATERIAL_TYPES.map(t => ({ value: t, label: t })),
          ]}
        />
      )}

      {config.showStatus && (
        <NativeSelect
          value={filters.status || "all"}
          onChange={e => onChange("status", e.target.value)}
          className="w-full sm:w-[140px] h-9 text-xs"
          options={[
            { value: "all", label: "Todos os Status" },
            ...(config.statusOptions || []).map(s => ({ value: s, label: s })),
          ]}
        />
      )}

      {config.showPeriod && (
        <>
          <Input type="date" className="w-full sm:w-[140px] h-9 text-xs" value={filters.dateFrom || ""} onChange={e => onChange("dateFrom", e.target.value)} />
          <span className="text-xs text-muted-foreground">até</span>
          <Input type="date" className="w-full sm:w-[140px] h-9 text-xs" value={filters.dateTo || ""} onChange={e => onChange("dateTo", e.target.value)} />
        </>
      )}

      {hasActive && (
        <Button variant="ghost" size="sm" className="h-9 gap-1 text-xs" onClick={onClear}>
          <X className="w-3 h-3" /> Limpar
        </Button>
      )}
    </div>
  );
}
