import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/auditLog";
import { useQueryClient } from "@tanstack/react-query";
import { useLiderancas } from "@/hooks/useSupabaseData";
import { useCoordenadores } from "@/hooks/useCoordenadores";
import { isEletronico } from "@/components/logistics/StockEntryDialog";

const movementTypes = ["Entrada", "Saída", "Devolução"] as const;
const movementStatuses = ["Separado", "Em Trânsito", "Confirmado"] as const;

type MaterialRow = { id: string; name: string; type?: string; model?: string | null; serial_number?: string | null };
type ItemLinha = { materialId: string; quantity: string; model: string; serialNumber: string };

const linhaVazia = (): ItemLinha => ({ materialId: "", quantity: "", model: "", serialNumber: "" });

export function MovementFormDialog() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: liderancas = [] } = useLiderancas();
  const { data: coordenadores = [] } = useCoordenadores();

  const [itens, setItens] = useState<ItemLinha[]>([linhaVazia()]);
  const [form, setForm] = useState({
    type: "", city: "", notes: "", status: "Confirmado",
    leaderName: "", coordinatorName: "", finalidade: "Distribuição",
  });

  useEffect(() => {
    if (open) {
      supabase.from("materials").select("id, name, type, model, serial_number").order("name").then(({ data }) => {
        if (data) setMaterials(data as any[]);
      });
    }
  }, [open]);

  const update = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  const updateItem = (index: number, patch: Partial<ItemLinha>) =>
    setItens(prev => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));

  const onSelectMaterial = (index: number, materialId: string) => {
    const mat = materials.find(m => m.id === materialId);
    updateItem(index, {
      materialId,
      model: mat?.model ?? "",
      serialNumber: mat?.serial_number ?? "",
    });
  };

  const isItemEletronico = (materialId: string) => {
    const mat = materials.find(m => m.id === materialId);
    return isEletronico(mat?.type) || isEletronico(mat?.name);
  };

  const resetAll = () => {
    setItens([linhaVazia()]);
    setForm({ type: "", city: "", notes: "", status: "Confirmado", leaderName: "", coordinatorName: "", finalidade: "Distribuição" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validos = itens.filter(i => i.materialId && i.quantity && parseInt(i.quantity) > 0);
    if (!form.type || validos.length === 0) {
      toast({ title: "Preencha o tipo e ao menos um item com quantidade", variant: "destructive" });
      return;
    }
    const duplicados = new Set(validos.map(i => i.materialId)).size !== validos.length;
    if (duplicados) {
      toast({ title: "Há materiais repetidos na lista", description: "Some as quantidades em uma única linha.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const payload = validos.map(item => {
        const detalhes = [
          form.type === "Saída" && form.finalidade === "Empréstimo" ? "Empréstimo (item deve retornar)" : "",
          item.model && `Modelo: ${item.model}`,
          item.serialNumber && `IMEI/SN: ${item.serialNumber}`,
          form.notes,
        ].filter(Boolean).join(" | ");

        return {
          material_id: item.materialId,
          type: form.type,
          quantity: parseInt(item.quantity),
          city: form.city || null,
          notes: detalhes || null,
          status: form.status,
          leader_name: form.leaderName || null,
          coordinator_name: form.coordinatorName || null,
          model: item.model || null,
          serial_number: item.serialNumber || null,
        };
      });

      const { error, data } = await supabase.from("movements").insert(payload).select();
      if (error) throw error;

      for (const row of (data || []) as any[]) {
        await logAudit("INSERT", "movements", row.id, { type: form.type, quantity: row.quantity, status: form.status });
      }

      queryClient.invalidateQueries({ queryKey: ["log-movements"] });
      queryClient.invalidateQueries({ queryKey: ["log-materials"] });
      queryClient.invalidateQueries({ queryKey: ["log-dashboard"] });
      toast({ title: `${payload.length} movimentação(ões) registrada(s) com sucesso!` });
      setOpen(false);
      resetAll();
    } catch (err: any) {
      toast({ title: "Erro ao registrar movimentação", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2"><Plus className="w-4 h-4" /> Nova Movimentação</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[calc(100dvh-1rem)] overflow-auto">
        <DialogHeader>
          <DialogTitle>Registrar Movimentação</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Itens *</Label>
              <Button type="button" size="sm" variant="outline" onClick={() => setItens(prev => [...prev, linhaVazia()])}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar item
              </Button>
            </div>
            {itens.map((item, index) => (
              <div key={index} className="rounded-md border p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <div className="flex-1 space-y-1.5">
                    <Label className="text-xs">Material</Label>
                    <NativeSelect
                      value={item.materialId}
                      onChange={e => onSelectMaterial(index, e.target.value)}
                      options={[
                        { value: "", label: "Selecione o material" },
                        ...materials.map(m => ({ value: m.id, label: m.name })),
                      ]}
                    />
                  </div>
                  <div className="w-28 space-y-1.5">
                    <Label className="text-xs">Qtd</Label>
                    <Input type="number" min="1" value={item.quantity} onChange={e => updateItem(index, { quantity: e.target.value })} />
                  </div>
                  {itens.length > 1 && (
                    <Button type="button" size="icon" variant="ghost" className="mt-6 h-9 w-9 shrink-0"
                      onClick={() => setItens(prev => prev.filter((_, i) => i !== index))}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  )}
                </div>
                {isItemEletronico(item.materialId) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Modelo</Label>
                      <Input value={item.model} onChange={e => updateItem(index, { model: e.target.value })} maxLength={100} placeholder="Ex.: Xiaomi Redmi Note 13" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">IMEI / SN</Label>
                      <Input value={item.serialNumber} onChange={e => updateItem(index, { serialNumber: e.target.value })} maxLength={60} />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo *</Label>
              <NativeSelect
                value={form.type}
                onChange={e => update("type", e.target.value)}
                options={[
                  { value: "", label: "Selecione" },
                  ...movementTypes.map(t => ({ value: t, label: t })),
                ]}
              />
            </div>
            {form.type === "Saída" && (
              <div className="space-y-1.5">
                <Label>Finalidade da saída</Label>
                <NativeSelect
                  value={form.finalidade}
                  onChange={e => update("finalidade", e.target.value)}
                  options={[
                    { value: "Distribuição", label: "Distribuição (não retorna)" },
                    { value: "Empréstimo", label: "Empréstimo (deve retornar)" },
                  ]}
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Liderança (Destinatário)</Label>
              <NativeSelect
                value={form.leaderName}
                onChange={e => update("leaderName", e.target.value)}
                options={[
                  { value: "", label: "Selecione a liderança" },
                  ...liderancas.map((l: any) => ({ value: l.nome, label: l.nome })),
                ]}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Coordenador</Label>
              <NativeSelect
                value={form.coordinatorName}
                onChange={e => update("coordinatorName", e.target.value)}
                options={[
                  { value: "", label: "Selecione o coordenador" },
                  ...coordenadores.map((c: any) => ({ value: c.nome, label: c.nome })),
                ]}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Status da Entrega *</Label>
              <NativeSelect
                value={form.status}
                onChange={e => update("status", e.target.value)}
                options={movementStatuses.map(s => ({ value: s, label: s }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Cidade</Label>
              <Input value={form.city} onChange={e => update("city", e.target.value)} maxLength={50} />
            </div>
            <div className="col-span-1 sm:col-span-2 space-y-1.5">
              <Label>Observações</Label>
              <Textarea value={form.notes} onChange={e => update("notes", e.target.value)} maxLength={500} rows={2} />
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Salvando..." : "Registrar Movimentação"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
