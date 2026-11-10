import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/auditLog";
import { useQueryClient } from "@tanstack/react-query";
import { useCoordenadores } from "@/hooks/useCoordenadores";

const statuses = ["Ativo", "Inativo", "Bloqueado"] as const;

interface PersonFormDialogProps {
  editData?: {
    id: string;
    full_name: string;
    cpf: string | null;
    phone: string | null;
    city: string | null;
    neighborhood: string | null;
    region: string | null;
    management: string | null;
    status: string;
    user_id: string;
  };
  trigger?: React.ReactNode;
}

export function PersonFormDialog({ editData, trigger }: PersonFormDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: coordenadores = [] } = useCoordenadores();
  const isEdit = !!editData;

  const [form, setForm] = useState({
    name: "", cpf: "", phone: "", city: "", neighborhood: "", region: "", management: "", status: "Ativo",
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

  const statusOptions = statuses.map((status) => ({ value: status, label: status }));

  useEffect(() => {
    if (open && editData) {
      setForm({
        name: editData.full_name,
        cpf: editData.cpf || "",
        phone: editData.phone || "",
        city: editData.city || "",
        neighborhood: editData.neighborhood || "",
        region: editData.region || "",
        management: editData.management || "",
        status: editData.status,
      });
    }
  }, [open, editData]);

  const update = (key: keyof typeof form, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.cpf || !form.phone || !form.city) {
      toast({ title: "Preencha todos os campos obrigatórios", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      if (isEdit) {
        const { error } = await supabase.from("logistics_profiles" as any).update({
          full_name: form.name,
          cpf: form.cpf,
          phone: form.phone,
          city: form.city,
          neighborhood: form.neighborhood || null,
          region: form.region || null,
          management: form.management || null,
          status: form.status,
        }).eq("id", editData!.id);

        if (error) throw error;

        await logAudit("UPDATE", "logistics_profiles", editData!.id, { name: form.name });
        toast({ title: "Pessoa atualizada com sucesso!" });
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        const { error, data } = await supabase.from("logistics_profiles" as any).insert({
          user_id: user!.id,
          full_name: form.name,
          cpf: form.cpf,
          phone: form.phone,
          city: form.city,
          neighborhood: form.neighborhood || null,
          region: form.region || null,
          management: form.management || null,
          status: form.status,
        }).select().single();

        if (error) throw error;

        await logAudit("INSERT", "logistics_profiles", (data as any).id, { name: form.name, cpf: form.cpf });
        toast({ title: "Pessoa cadastrada com sucesso!" });
      }

      queryClient.invalidateQueries({ queryKey: ["log-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["log-dashboard"] });
      setOpen(false);

      if (!isEdit) {
        setForm({ name: "", cpf: "", phone: "", city: "", neighborhood: "", region: "", management: "", status: "Ativo" });
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
        {trigger || <Button className="gap-2"><Plus className="w-4 h-4" /> Nova Pessoa</Button>}
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[calc(100dvh-1rem)] overflow-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar Pessoa" : "Cadastrar Pessoa"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="col-span-1 sm:col-span-2 space-y-1.5">
              <Label>Nome Completo *</Label>
              <Input value={form.name} onChange={(e) => update("name", e.target.value)} maxLength={100} required />
            </div>
            <div className="space-y-1.5">
              <Label>CPF *</Label>
              <Input value={form.cpf} onChange={(e) => update("cpf", e.target.value)} maxLength={14} required placeholder="000.000.000-00" />
            </div>
            <div className="space-y-1.5">
              <Label>Telefone *</Label>
              <Input value={form.phone} onChange={(e) => update("phone", e.target.value)} maxLength={15} required placeholder="(00) 00000-0000" />
            </div>
            <div className="space-y-1.5">
              <Label>Cidade *</Label>
              <Input value={form.city} onChange={(e) => update("city", e.target.value)} maxLength={50} required />
            </div>
            <div className="space-y-1.5">
              <Label>Bairro</Label>
              <Input value={form.neighborhood} onChange={(e) => update("neighborhood", e.target.value)} maxLength={80} placeholder="Nome do bairro" />
            </div>
            <div className="space-y-1.5">
              <Label>Região</Label>
              <Input value={form.region} onChange={(e) => update("region", e.target.value)} maxLength={50} placeholder="Digite a região" />
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
              <Label>Status</Label>
              <NativeSelect
                value={form.status}
                onChange={(e) => update("status", e.target.value)}
                options={statusOptions}
              />
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Salvando..." : isEdit ? "Salvar Alterações" : "Cadastrar Pessoa"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
