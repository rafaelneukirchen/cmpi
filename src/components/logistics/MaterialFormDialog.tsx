import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Plus } from "lucide-react";
import { MATERIAL_TYPES } from "@/types/campaign";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/auditLog";
import { useQueryClient } from "@tanstack/react-query";
import { useCoordenadores } from "@/hooks/useCoordenadores";
import { isEletronico } from "@/components/logistics/StockEntryDialog";


interface MaterialFormDialogProps {
  editData?: {
    id: string;
    name: string;
    type: string;
    total_qty: number;
    unit_price: number;
    min_stock_qty?: number;
    management: string | null;
    city: string | null;
    sent_date: string | null;
    model?: string | null;
    serial_number?: string | null;
  };
  trigger?: React.ReactNode;
}

export function MaterialFormDialog({ editData, trigger }: MaterialFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dbDescriptions, setDbDescriptions] = useState<string[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: coordenadores = [] } = useCoordenadores();
  const isEdit = !!editData;

  const [form, setForm] = useState({
    description: "", customDescription: "", totalQty: "", unitPrice: "", minStockQty: "", management: "", city: "", sentDate: "", model: "", serialNumber: "",
  });


  const coordinatorOptions = useMemo(() => {
    const names = new Set<string>();

    coordenadores.forEach((coordenador) => {
      const nome = coordenador.nome?.trim();
      if (nome) names.add(nome);
    });

    if (editData?.management) {
      names.add(editData.management);
    }

    return [
      { value: "", label: "Nenhum" },
      ...Array.from(names)
        .sort((a, b) => a.localeCompare(b, "pt-BR"))
        .map((nome) => ({ value: nome, label: nome })),
    ];
  }, [coordenadores, editData?.management]);

  const descriptionOptions = useMemo(
    () => [
      ...dbDescriptions.map((description) => ({ value: description, label: description })),
      { value: "__custom__", label: "+ Nova descrição..." },
    ],
    [dbDescriptions],
  );

  useEffect(() => {
    if (open && editData) {
      setForm({
        description: editData.type,
        customDescription: "",
        totalQty: editData.total_qty.toString(),
        unitPrice: editData.unit_price.toString(),
        minStockQty: (editData.min_stock_qty ?? 0).toString(),
        management: editData.management || "",
        city: editData.city || "",
        sentDate: editData.sent_date || "",
        model: editData.model || "",
        serialNumber: editData.serial_number || "",

      });
    }
  }, [open, editData]);

  useEffect(() => {
    if (!open) return;

    let active = true;

    const loadDescriptions = async () => {
      const { data } = await supabase.from("materials" as any).select("type");
      if (!active || !data) return;

      const unique = [...new Set((data as any[]).map((entry) => entry.type).filter(Boolean))] as string[];
      const allDescriptions = [...new Set([...MATERIAL_TYPES, ...unique])].sort((a, b) => a.localeCompare(b, "pt-BR"));
      setDbDescriptions(allDescriptions);
    };

    void loadDescriptions();

    return () => {
      active = false;
    };
  }, [open]);

  const update = (key: keyof typeof form, value: string) => setForm((prev) => ({ ...prev, [key]: value }));
  const totalPrice = (Number(form.totalQty) || 0) * (Number(form.unitPrice) || 0);
  const isCustomDescription = form.description === "__custom__";

  useEffect(() => {
    if (open && editData && dbDescriptions.length > 0 && !dbDescriptions.includes(editData.type)) {
      setDbDescriptions((prev) => [...prev, editData.type].sort((a, b) => a.localeCompare(b, "pt-BR")));
    }
  }, [open, editData, dbDescriptions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalDescription = isCustomDescription ? form.customDescription.trim() : form.description;

    if (!finalDescription || !form.totalQty || !form.unitPrice) {
      toast({ title: "Preencha os campos obrigatórios", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const qty = parseInt(form.totalQty, 10);
      const price = parseFloat(form.unitPrice);
      const minStock = parseInt(form.minStockQty, 10) || 0;

      if (isEdit) {
        const { error } = await supabase.from("materials" as any).update({
          name: finalDescription,
          type: finalDescription,
          total_qty: qty,
          unit_price: price,
          min_stock_qty: minStock,
          management: form.management || null,
          city: form.city || null,
          sent_date: form.sentDate || null,
          model: isEletronico(finalDescription) ? form.model || null : null,
          serial_number: isEletronico(finalDescription) ? form.serialNumber || null : null,

        }).eq("id", editData!.id);

        if (error) throw error;

        await logAudit("UPDATE", "materials", editData!.id, { type: finalDescription });
        toast({ title: "Material atualizado com sucesso!" });
      } else {
        const { error, data } = await supabase.from("materials" as any).insert({
          name: finalDescription,
          type: finalDescription,
          total_qty: qty,
          available_qty: qty,
          unit_price: price,
          min_stock_qty: minStock,
          management: form.management || null,
          city: form.city || null,
          sent_date: form.sentDate || null,
          model: isEletronico(finalDescription) ? form.model || null : null,
          serial_number: isEletronico(finalDescription) ? form.serialNumber || null : null,

        }).select().single();

        if (error) throw error;

        await logAudit("INSERT", "materials", (data as any).id, { type: finalDescription });
        toast({ title: "Material cadastrado com sucesso!" });
      }

      queryClient.invalidateQueries({ queryKey: ["log-materials"] });
      queryClient.invalidateQueries({ queryKey: ["log-dashboard"] });
      setOpen(false);

      if (!isEdit) {
        setForm({ description: "", customDescription: "", totalQty: "", unitPrice: "", minStockQty: "", management: "", city: "", sentDate: "", model: "", serialNumber: "" });
      }
    } catch (err: any) {
      toast({ title: isEdit ? "Erro ao atualizar" : "Erro ao cadastrar", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || <Button className="gap-2"><Plus className="w-4 h-4" /> Novo Material</Button>}
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[calc(100dvh-1rem)] overflow-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar Material" : "Cadastrar Material"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="col-span-1 sm:col-span-2 space-y-1.5">
              <Label>Descrição *</Label>
              <NativeSelect
                value={form.description}
                onChange={(e) => {
                  const value = e.target.value;
                  update("description", value);
                  if (value !== "__custom__") update("customDescription", "");
                }}
                options={descriptionOptions}
                placeholder="Selecione a descrição"
              />
              {isCustomDescription && (
                <Input value={form.customDescription} onChange={(e) => update("customDescription", e.target.value)} placeholder="Digite a nova descrição" maxLength={100} className="mt-1.5" required />
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Quantidade Total *</Label>
              <Input type="number" min="1" value={form.totalQty} onChange={(e) => update("totalQty", e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Valor Unitário (R$) *</Label>
              <Input type="number" min="0" step="0.01" value={form.unitPrice} onChange={(e) => update("unitPrice", e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Valor Total</Label>
              <Input value={`R$ ${totalPrice.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} disabled />
            </div>
            <div className="space-y-1.5">
              <Label>Estoque Mínimo</Label>
              <Input type="number" min="0" value={form.minStockQty} onChange={(e) => update("minStockQty", e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <Label>Coordenador</Label>
              <NativeSelect
                value={form.management}
                onChange={(e) => update("management", e.target.value)}
                options={coordinatorOptions}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Cidade Destino</Label>
              <Input value={form.city} onChange={(e) => update("city", e.target.value)} maxLength={50} />
            </div>
            <div className="space-y-1.5">
              <Label>Data de Envio</Label>
              <Input type="date" value={form.sentDate} onChange={(e) => update("sentDate", e.target.value)} />
            </div>
            {isEletronico(isCustomDescription ? form.customDescription : form.description) && (
              <>
                <div className="space-y-1.5">
                  <Label>Modelo</Label>
                  <Input value={form.model} onChange={(e) => update("model", e.target.value)} maxLength={100} placeholder="Ex.: Xiaomi Redmi Note 13" />
                </div>
                <div className="space-y-1.5">
                  <Label>IMEI / Número de Série (SN)</Label>
                  <Input value={form.serialNumber} onChange={(e) => update("serialNumber", e.target.value)} maxLength={60} placeholder="Ex.: 356938035643809" />
                </div>
              </>
            )}

          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Salvando..." : isEdit ? "Salvar Alterações" : "Cadastrar Material"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
