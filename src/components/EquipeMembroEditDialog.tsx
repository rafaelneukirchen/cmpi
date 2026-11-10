import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { REGIONS } from "@/types/campaign";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  membroId: string;
  initialNome: string;
  initialTelefone: string;
  initialRegiao: string | null;
  onSaved?: () => void;
}

function onlyDigits(s: string) {
  return (s || "").replace(/\D/g, "").slice(0, 11);
}
function formatPhone(d: string) {
  const v = onlyDigits(d);
  if (v.length <= 2) return v;
  if (v.length <= 7) return `(${v.slice(0, 2)}) ${v.slice(2)}`;
  return `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7)}`;
}

export function EquipeMembroEditDialog({
  open, onOpenChange, membroId,
  initialNome, initialTelefone, initialRegiao, onSaved,
}: Props) {
  const [nome, setNome] = useState(initialNome);
  const [telefone, setTelefone] = useState(onlyDigits(initialTelefone));
  const [regiao, setRegiao] = useState(initialRegiao || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setNome(initialNome);
      setTelefone(onlyDigits(initialTelefone));
      setRegiao(initialRegiao || "");
    }
  }, [open, initialNome, initialTelefone, initialRegiao]);

  async function handleSave() {
    if (!nome.trim()) return toast.error("Nome é obrigatório");
    if (telefone.length !== 11) return toast.error("Telefone precisa ter 11 dígitos (DDD + celular)");
    setSaving(true);
    try {
      const { error } = await supabase
        .from("equipe_membros")
        .update({ nome: nome.trim(), telefone, regiao: regiao || null })
        .eq("id", membroId);
      if (error) throw error;
      toast.success("Cadastro atualizado");
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
          <DialogTitle>Editar cadastro do membro</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="em-nome">Nome completo</Label>
            <Input id="em-nome" value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="off" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="em-tel">Telefone (DDD + número)</Label>
            <Input
              id="em-tel"
              value={formatPhone(telefone)}
              onChange={(e) => setTelefone(onlyDigits(e.target.value))}
              placeholder="(11) 99999-9999"
              inputMode="numeric"
              autoComplete="off"
            />
            <p className="text-[11px] text-muted-foreground">{telefone.length}/11 dígitos</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="em-regiao">Região</Label>
            <NativeSelect
              id="em-regiao"
              value={regiao}
              onChange={(e) => setRegiao(e.target.value)}
              options={[{ value: "", label: "—" }, ...REGIONS.map((r) => ({ value: r, label: r }))]}
            />
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
