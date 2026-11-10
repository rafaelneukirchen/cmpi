import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useVisitas, useCidades, useLiderancas } from "@/hooks/useSupabaseData";
import { Loader2, Pencil, Search } from "lucide-react";
import { DeleteConfirmDialog } from "@/components/logistics/DeleteConfirmDialog";
import VisitaFormDialog from "@/components/VisitaFormDialog";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";


export default function Visitas() {
  const { data: visitas = [], isLoading: lv } = useVisitas();
  const { data: cidades = [], isLoading: lc } = useCidades();
  const { data: liderancas = [], isLoading: ll } = useLiderancas();
  const cidadeMap = useMemo(() => new Map(cidades.map(c => [c.id, c])), [cidades]);
  const liderancaMap = useMemo(() => new Map(liderancas.map(l => [l.id, l])), [liderancas]);
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return visitas;
    return visitas.filter(v => {
      const cidade = (cidadeMap.get(v.cidade_id)?.nome || "").toLowerCase();
      const lid = (v.lideranca_id ? liderancaMap.get(v.lideranca_id)?.nome || "" : "").toLowerCase();
      const vv = v as any;
      const local = `${vv.endereco || ""} ${vv.bairro || ""}`.toLowerCase();
      const obj = (v.objetivo || "").toLowerCase();
      return cidade.includes(q) || lid.includes(q) || local.includes(q) || obj.includes(q);
    });
  }, [visitas, search, cidadeMap, liderancaMap]);


  async function handleDelete(id: string) {
    const { error } = await supabase.from("visitas_campanha").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Visita excluída!");
    queryClient.invalidateQueries({ queryKey: ["visitas"] });
  }

  if (lv || lc || ll) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Visitas de Campanha</h1>
          <p className="text-muted-foreground">Registro de visitas realizadas</p>
        </div>
        <VisitaFormDialog />
      </div>
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por cidade, liderança ou objetivo..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cidade</TableHead>
                  <TableHead>Endereço / Local</TableHead>
                  <TableHead>Liderança</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Equipe</TableHead>
                  <TableHead>Objetivo</TableHead>
                  <TableHead>Resultado</TableHead>
                  <TableHead className="w-20">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(v => {
                  const vv = v as any;
                  const local = [vv.endereco, vv.bairro].filter(Boolean).join(', ');
                  return (
                    <TableRow key={v.id}>
                      <TableCell className="font-medium">{cidadeMap.get(v.cidade_id)?.nome}</TableCell>
                      <TableCell className="max-w-[200px]">
                        {local ? (
                          <div>
                            <span className="text-sm">{local}</span>
                            {vv.local_referencia && <span className="block text-xs text-muted-foreground italic">Ref: {vv.local_referencia}</span>}
                          </div>
                        ) : '-'}
                      </TableCell>
                      <TableCell>{v.lideranca_id ? liderancaMap.get(v.lideranca_id)?.nome || '-' : '-'}</TableCell>
                      <TableCell>{new Date(v.data_visita).toLocaleDateString('pt-BR')}</TableCell>
                      <TableCell>{v.equipe_responsavel || '-'}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{v.objetivo || '-'}</TableCell>
                      <TableCell><Badge variant="secondary">{v.resultado || 'Pendente'}</Badge></TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <VisitaFormDialog visita={v} trigger={<Button size="icon" variant="ghost" className="h-8 w-8"><Pencil className="h-3.5 w-3.5" /></Button>} />
                          <DeleteConfirmDialog title="Excluir Visita" description="Deseja excluir esta visita? Esta ação não pode ser desfeita." onConfirm={() => handleDelete(v.id)} />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhuma visita encontrada</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
