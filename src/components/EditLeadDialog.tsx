import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type EditLeadType = "lideranca" | "eleitor" | "logistica";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tipo: EditLeadType;
  recordId: string;
  initialNome: string;
  initialTelefone: string;
  onSaved?: () => void;
}

function onlyDigits(s: string): string {
  return (s || "").replace(/\D/g, "").slice(0, 11);
}

function formatPhoneDisplay(d: string): string {
  const v = onlyDigits(d);
  if (v.length <= 2) return v;
  if (v.length <= 7) return `(${v.slice(0, 2)}) ${v.slice(2)}`;
  if (v.length <= 10) return `(${v.slice(0, 2)}) ${v.slice(2, 6)}-${v.slice(6)}`;
  return `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7, 11)}`;
}

export function EditLeadDialog({ open, onOpenChange, tipo, recordId, initialNome, initialTelefone, onSaved }: Props) {
  const [nome, setNome] = useState(initialNome);
  const [telefone, setTelefone] = useState(onlyDigits(initialTelefone));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setNome(initialNome);
      setTelefone(onlyDigits(initialTelefone));
    }
  }, [open, initialNome, initialTelefone]);

  async function handleSave() {
    if (!nome.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    if (telefone.length < 10 || telefone.length > 11) {
      toast.error("Telefone deve ter entre 10 e 11 dígitos (DDD + número)");
      return;
    }
    setSaving(true);
    try {
      let error: any = null;
      if (tipo === "lideranca") {
        ({ error } = await supabase.from("liderancas").update({ nome: nome.trim(), telefone, whatsapp: telefone }).eq("id", recordId));
      } else if (tipo === "eleitor") {
        ({ error } = await supabase.from("eleitores_captados" as never).update({ nome_completo: nome.trim(), telefone } as never).eq("id", recordId));
      } else {
        ({ error } = await supabase.from("logistics_profiles").update({ full_name: nome.trim(), phone: telefone }).eq("id", recordId));
      }
      if (error) throw error;
      toast.success("Contato atualizado");
      onSaved?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar contato</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="edit-lead-nome">Nome</Label>
            <Input id="edit-lead-nome" value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="off" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-lead-tel">Telefone (DDD + número, máx. 11 dígitos)</Label>
            <Input
              id="edit-lead-tel"
              value={formatPhoneDisplay(telefone)}
              onChange={(e) => setTelefone(onlyDigits(e.target.value))}
              placeholder="(11) 99999-9999"
              inputMode="numeric"
              autoComplete="off"
            />
            <p className="text-[11px] text-muted-foreground">{telefone.length}/11 dígitos</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
