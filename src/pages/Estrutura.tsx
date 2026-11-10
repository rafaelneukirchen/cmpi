import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useEstruturas, useCidades } from "@/hooks/useSupabaseData";
import { Loader2, Pencil, Search } from "lucide-react";
import { DeleteConfirmDialog } from "@/components/logistics/DeleteConfirmDialog";
import EstruturaFormDialog from "@/components/EstruturaFormDialog";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";


export default function Estrutura() {
  const { data: estruturas = [], isLoading: le } = useEstruturas();
  const { data: cidades = [], isLoading: lc } = useCidades();
  const cidadeMap = useMemo(() => new Map(cidades.map(c => [c.id, c])), [cidades]);
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return estruturas;
    return estruturas.filter(e => (cidadeMap.get(e.cidade_id)?.nome || "").toLowerCase().includes(q));
  }, [estruturas, search, cidadeMap]);


  async function handleDelete(id: string) {
    const { error } = await supabase.from("estrutura_campanha").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Estrutura excluída!");
    queryClient.invalidateQueries({ queryKey: ["estruturas"] });
  }

  if (le || lc) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Estrutura de Campanha</h1>
          <p className="text-muted-foreground">Recursos e infraestrutura por cidade</p>
        </div>
        <EstruturaFormDialog />
      </div>
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por cidade..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cidade</TableHead>
                  <TableHead className="text-right">Cabos Eleitorais</TableHead>
                  <TableHead className="text-right">Apoiadores</TableHead>
                  <TableHead className="text-right">Veículos</TableHead>
                  <TableHead className="text-right">Materiais Distribuídos</TableHead>
                  <TableHead className="w-20">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(e => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{cidadeMap.get(e.cidade_id)?.nome}</TableCell>
                    <TableCell className="text-right">{e.cabos_eleitorais}</TableCell>
                    <TableCell className="text-right">{(e.apoiadores || 0).toLocaleString('pt-BR')}</TableCell>
                    <TableCell className="text-right">{e.veiculos}</TableCell>
                    <TableCell className="text-right">{(e.materiais_distribuidos || 0).toLocaleString('pt-BR')}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <EstruturaFormDialog estrutura={e} trigger={<Button size="icon" variant="ghost" className="h-8 w-8"><Pencil className="h-3.5 w-3.5" /></Button>} />
                        <DeleteConfirmDialog title="Excluir Estrutura" description="Deseja excluir esta estrutura? Esta ação não pode ser desfeita." onConfirm={() => handleDelete(e.id)} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhuma estrutura encontrada</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>

        </CardContent>
      </Card>
    </div>
  );
}
