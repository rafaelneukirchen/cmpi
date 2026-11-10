import * as React from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type SearchSelectOption = { value: string; label: string; hint?: string };

interface SearchSelectProps {
  value?: string;
  onChange: (value: string) => void;
  options: SearchSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  disabled?: boolean;
  allowClear?: boolean;
  clearLabel?: string;
}

/**
 * Componente de select com busca por texto, sem Radix (para evitar
 * conflitos com Leaflet/DOM). Renderizado inline (sem portal).
 */
export const SearchSelect = React.forwardRef<HTMLDivElement, SearchSelectProps>(
  (
    {
      value,
      onChange,
      options,
      placeholder = "Selecione...",
      searchPlaceholder = "Buscar...",
      emptyText = "Nenhum resultado",
      className,
      disabled,
      allowClear = false,
      clearLabel = "Limpar",
    },
    ref
  ) => {
    const [open, setOpen] = React.useState(false);
    const [query, setQuery] = React.useState("");
    const rootRef = React.useRef<HTMLDivElement>(null);
    const inputRef = React.useRef<HTMLInputElement>(null);

    React.useImperativeHandle(ref, () => rootRef.current as HTMLDivElement);

    React.useEffect(() => {
      if (!open) return;
      const handler = (e: MouseEvent) => {
        if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
          setOpen(false);
          setQuery("");
        }
      };
      document.addEventListener("mousedown", handler);
      return () => document.removeEventListener("mousedown", handler);
    }, [open]);

    React.useEffect(() => {
      if (open) setTimeout(() => inputRef.current?.focus(), 30);
    }, [open]);

    const selected = options.find((o) => o.value === value);

    const normalize = (s: string) =>
      s
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

    const filtered = React.useMemo(() => {
      const q = normalize(query.trim());
      if (!q) return options;
      return options.filter(
        (o) =>
          normalize(o.label).includes(q) ||
          (o.hint && normalize(o.hint).includes(q))
      );
    }, [options, query]);

    return (
      <div ref={rootRef} className={cn("relative", className)}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50"
          )}
        >
          <span className={cn("truncate text-left", !selected && "text-muted-foreground")}>
            {selected ? selected.label : placeholder}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            {allowClear && selected && (
              <span
                role="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.stopPropagation();
                  onChange("");
                }}
                className="p-0.5 rounded hover:bg-muted"
                aria-label="Limpar"
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </span>
            )}
            <ChevronDown className="h-4 w-4 opacity-50" />
          </div>
        </button>

        {open && (
          <div className="absolute z-50 mt-1 w-full min-w-[220px] rounded-md border bg-popover text-popover-foreground shadow-md">
            <div className="flex items-center border-b px-2">
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="h-9 w-full bg-transparent px-2 text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
            <div className="max-h-64 overflow-y-auto py-1">
              {allowClear && (
                <button
                  type="button"
                  onClick={() => {
                    onChange("");
                    setOpen(false);
                    setQuery("");
                  }}
                  className="flex w-full items-center px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent"
                >
                  {clearLabel}
                </button>
              )}
              {filtered.length === 0 && (
                <div className="px-3 py-4 text-center text-sm text-muted-foreground">{emptyText}</div>
              )}
              {filtered.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                    setQuery("");
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 px-2 py-1.5 text-sm text-left hover:bg-accent",
                    o.value === value && "bg-accent"
                  )}
                >
                  <Check
                    className={cn("h-4 w-4 shrink-0", o.value === value ? "opacity-100" : "opacity-0")}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="truncate">{o.label}</div>
                    {o.hint && <div className="truncate text-xs text-muted-foreground">{o.hint}</div>}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }
);
SearchSelect.displayName = "SearchSelect";
