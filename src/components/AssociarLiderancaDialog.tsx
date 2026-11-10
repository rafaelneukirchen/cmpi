import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { useLiderancas } from "@/hooks/useSupabaseData";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, UserPlus, Check } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

interface Props {
  cidadeId: string;
  cidadeNome: string;
  trigger?: React.ReactNode;
}

export default function AssociarLiderancaDialog({ cidadeId, cidadeNome, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: liderancas = [] } = useLiderancas();
  const queryClient = useQueryClient();

  const jaAssociadas = useMemo(() => {
    return new Set(
      liderancas
        .filter(l => l.cidade_base_id === cidadeId || (l.cidades_representadas as string[] || []).includes(cidadeId))
        .map(l => l.id)
    );
  }, [liderancas, cidadeId]);

  async function handleAssociar() {
    if (!selectedId) return;
    setSaving(true);
    try {
      const lideranca = liderancas.find(l => l.id === selectedId);
      if (!lideranca) throw new Error("Liderança não encontrada");

      const currentCidades = (lideranca.cidades_representadas as string[]) || [];
      if (currentCidades.includes(cidadeId)) {
        toast.info("Esta liderança já está associada a esta cidade");
        setSaving(false);
        return;
      }

      const { error } = await supabase
        .from("liderancas")
        .update({ cidades_representadas: [...currentCidades, cidadeId] })
        .eq("id", selectedId);

      if (error) throw error;

      toast.success(`${lideranca.nome} associado(a) a ${cidadeNome}!`);
      setOpen(false);
      setSelectedId(null);
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["liderancas"] });
      }, 150);
    } catch (err: any) {
      toast.error(err.message || "Erro ao associar liderança");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setSelectedId(null); }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="sm" variant="outline">
            <UserPlus className="h-3.5 w-3.5 mr-1" />
            Vincular Liderança
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Vincular liderança a {cidadeNome}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Selecione uma liderança já cadastrada para associar a esta cidade.
        </p>
        <Command className="border rounded-lg">
          <CommandInput placeholder="Buscar liderança..." />
          <CommandList className="max-h-[250px]">
            <CommandEmpty>Nenhuma liderança encontrada.</CommandEmpty>
            <CommandGroup>
              {liderancas.map(l => {
                const isAssociada = jaAssociadas.has(l.id);
                return (
                  <CommandItem
                    key={l.id}
                    value={l.nome}
                    onSelect={() => !isAssociada && setSelectedId(l.id)}
                    className={isAssociada ? "opacity-50" : ""}
                    disabled={isAssociada}
                  >
                    <Check className={`mr-2 h-4 w-4 ${selectedId === l.id ? "opacity-100" : isAssociada ? "opacity-100 text-primary" : "opacity-0"}`} />
                    <div className="flex-1">
                      <span className="font-medium">{l.nome}</span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {l.forca_politica}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {l.status}
                        </Badge>
                        {isAssociada && (
                          <span className="text-[10px] text-primary">já vinculada</span>
                        )}
                      </div>
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={handleAssociar} disabled={!selectedId || saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Vincular
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
