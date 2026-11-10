import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { PackagePlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/auditLog";
import { useQueryClient } from "@tanstack/react-query";

interface MaterialOption {
  id: string;
  name: string;
  type: string;
  total_qty: number;
  available_qty: number;
  unit_price: number;
  model?: string | null;
  serial_number?: string | null;
}

const ELETRONICO_KEYWORDS = [
  "celular", "smartphone", "notebook", "laptop", "tablet", "eletr", "computador",
  "monitor", "impressora", "radio", "rádio", "camera", "câmera", "drone", "chip", "modem", "roteador",
];

export const isEletronico = (value?: string | null) =>
  !!value && ELETRONICO_KEYWORDS.some((k) => value.toLowerCase().includes(k));


interface StockEntryDialogProps {
  material?: MaterialOption;
  trigger?: React.ReactNode;
}

export function StockEntryDialog({ material, trigger }: StockEntryDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [materials, setMaterials] = useState<MaterialOption[]>([]);
  const [materialId, setMaterialId] = useState(material?.id ?? "");
  const [quantity, setQuantity] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [notes, setNotes] = useState("");
  const [motivo, setMotivo] = useState<"Compra" | "Devolução">("Compra");
  const [model, setModel] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!open) return;
    setMaterialId(material?.id ?? "");
    setQuantity("");
    setUnitPrice(material ? String(material.unit_price ?? "") : "");
    setNotes("");
    setMotivo("Compra");
    setModel(material?.model ?? "");
    setSerialNumber(material?.serial_number ?? "");

    supabase
      .from("materials" as any)
      .select("id, name, type, total_qty, available_qty, unit_price, model, serial_number")
      .order("name")
      .then(({ data }) => {
        if (data) setMaterials(data as any[]);
      });
  }, [open, material]);

  const selected = useMemo(
    () => materials.find((m) => m.id === materialId) ?? material,
    [materials, materialId, material],
  );

  useEffect(() => {
    if (selected && unitPrice === "") setUnitPrice(String(selected.unit_price ?? ""));
    setModel(selected?.model ?? "");
    setSerialNumber(selected?.serial_number ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  const eletronico = isEletronico(selected?.type) || isEletronico(selected?.name);
  const qty = parseInt(quantity, 10) || 0;
  const price = parseFloat(unitPrice.replace(",", ".")) || 0;
  const totalEntrada = qty * price;
  const isDevolucao = motivo === "Devolução";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!materialId || qty <= 0) {
      toast({ title: "Selecione o material e informe a quantidade", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const identificacao = [model && `Modelo: ${model}`, serialNumber && `IMEI/SN: ${serialNumber}`]
        .filter(Boolean)
        .join(" — ");
      const notaPadrao = isDevolucao
        ? "Devolução de empréstimo — retorno ao estoque"
        : `Entrada de estoque${price ? ` — R$ ${price.toFixed(2)} un.` : ""}`;

      const { error: movError, data: mov } = await supabase
        .from("movements" as any)
        .insert({
          material_id: materialId,
          type: isDevolucao ? "Devolução" : "Entrada",
          quantity: qty,
          status: "Confirmado",
          model: model || null,
          serial_number: serialNumber || null,
          notes: [notes || notaPadrao, identificacao].filter(Boolean).join(" | "),
        })
        .select()
        .single();
      if (movError) throw movError;

      // O gatilho de estoque soma em "disponível". Em compras também aumentamos o total;
      // em devolução de empréstimo o total já existia, então não muda.
      const novoTotal = (selected?.total_qty ?? 0) + qty;
      const { error: matError } = await supabase
        .from("materials" as any)
        .update({
          ...(isDevolucao ? {} : { total_qty: novoTotal }),
          ...(price > 0 && !isDevolucao ? { unit_price: price } : {}),
          ...(eletronico ? { model: model || null, serial_number: serialNumber || null } : {}),
        })
        .eq("id", materialId);
      if (matError) throw matError;

      await logAudit("INSERT", "movements", (mov as any).id, {
        type: isDevolucao ? "Devolução" : "Entrada",
        quantity: qty,
        unit_price: price,
        model,
        serial_number: serialNumber,
      });

      queryClient.invalidateQueries({ queryKey: ["log-materials"] });
      queryClient.invalidateQueries({ queryKey: ["log-movements"] });
      queryClient.invalidateQueries({ queryKey: ["log-dashboard"] });
      toast({ title: isDevolucao ? "Devolução registrada com sucesso!" : "Entrada registrada com sucesso!" });
      setOpen(false);
    } catch (err: any) {
      toast({ title: "Erro ao registrar entrada", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };


  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" className="gap-2">
            <PackagePlus className="w-4 h-4" /> Entrada de Estoque
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[calc(100dvh-1rem)] overflow-auto">
        <DialogHeader>
          <DialogTitle>Entrada de Estoque</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Material existente *</Label>
            <NativeSelect
              value={materialId}
              onChange={(e) => setMaterialId(e.target.value)}
              options={[
                { value: "", label: "Selecione o material cadastrado" },
                ...materials.map((m) => ({ value: m.id, label: m.type || m.name })),
              ]}
            />
            {selected && (
              <p className="text-xs text-muted-foreground">
                Estoque atual: {selected.available_qty?.toLocaleString("pt-BR")} disponível de{" "}
                {selected.total_qty?.toLocaleString("pt-BR")} total
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Motivo da entrada *</Label>
              <NativeSelect
                value={motivo}
                onChange={(e) => setMotivo(e.target.value as "Compra" | "Devolução")}
                options={[
                  { value: "Compra", label: "Compra / Nova aquisição" },
                  { value: "Devolução", label: "Devolução de empréstimo (retorno ao estoque)" },
                ]}
              />
              {isDevolucao && (
                <p className="text-xs text-muted-foreground">
                  O item volta para o disponível sem aumentar o total cadastrado.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Quantidade recebida *</Label>
              <Input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Valor Unitário (R$)</Label>
              <Input type="number" min="0" step="0.01" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} disabled={isDevolucao} />
            </div>
            {eletronico && (
              <>
                <div className="space-y-1.5">
                  <Label>Modelo</Label>
                  <Input value={model} onChange={(e) => setModel(e.target.value)} maxLength={100} placeholder="Ex.: Xiaomi Redmi Note 13" />
                </div>
                <div className="space-y-1.5">
                  <Label>IMEI / Número de Série (SN)</Label>
                  <Input value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} maxLength={60} placeholder="Ex.: 356938035643809" />
                </div>
              </>
            )}
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Valor da Entrada</Label>
              <Input value={`R$ ${totalEntrada.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} disabled />
            </div>
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Observações</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} rows={2} />
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Salvando..." : isDevolucao ? "Registrar Devolução" : "Registrar Entrada"}
          </Button>

        </form>
      </DialogContent>
    </Dialog>
  );
}
