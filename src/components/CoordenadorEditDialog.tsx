import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

interface CoordenadorEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cidade: {
    id: string;
    nome: string;
    coordenador_nome?: string | null;
    coordenador_telefone?: string | null;
    coordenador_whatsapp?: string | null;
    coordenador_funcao?: string | null;
    coordenador_cor?: string | null;
  };
}

const funcoes = ["Coordenador Geral", "Coordenador Regional", "Coordenador de Bairro", "Subcoordenador"];

const PRESET_COLORS = [
  "#2563eb", "#dc2626", "#16a34a", "#d946ef", "#f97316",
  "#0891b2", "#8b5cf6", "#84cc16", "#f59e0b", "#6366f1",
  "#e11d48", "#14b8a6", "#ec4899", "#ef4444", "#06b6d4",
];

export default function CoordenadorEditDialog({ open, onOpenChange, cidade }: CoordenadorEditDialogProps) {
  const [nome, setNome] = useState(cidade.coordenador_nome || "");
  const [telefone, setTelefone] = useState(cidade.coordenador_telefone || "");
  const [whatsapp, setWhatsapp] = useState(cidade.coordenador_whatsapp || "");
  const [funcao, setFuncao] = useState(cidade.coordenador_funcao || "");
  const [cor, setCor] = useState(cidade.coordenador_cor || "");
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const handleSave = async () => {
    setSaving(true);
    const { error } = await (supabase.from("cidades") as any).update({
      coordenador_nome: nome || null,
      coordenador_telefone: telefone || null,
      coordenador_whatsapp: whatsapp || null,
      coordenador_funcao: funcao || null,
      coordenador_cor: cor || null,
    }).eq("id", cidade.id);
    setSaving(false);

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Coordenador salvo com sucesso" });
      onOpenChange(false);
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["cidades"] });
      }, 150);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Coordenador – {cidade.nome}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome do coordenador" maxLength={100} />
          </div>
          <div className="space-y-2">
            <Label>Telefone</Label>
            <Input value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(00) 00000-0000" maxLength={20} />
          </div>
          <div className="space-y-2">
            <Label>WhatsApp</Label>
            <Input value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="(00) 00000-0000" maxLength={20} />
          </div>
          <div className="space-y-2">
            <Label>Função</Label>
            <select
              value={funcao}
              onChange={(e) => setFuncao(e.target.value)}
              className="flex h-10 w-full items-center rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <option value="">Selecione a função</option>
              {funcoes.map(f => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Cor no Mapa</Label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCor(c)}
                  className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110"
                  style={{
                    background: c,
                    borderColor: cor === c ? "hsl(var(--foreground))" : "transparent",
                    transform: cor === c ? "scale(1.15)" : undefined,
                  }}
                />
              ))}
              <button
                type="button"
                onClick={() => setCor("")}
                className="w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs text-muted-foreground hover:scale-110 transition-transform"
                style={{ borderColor: !cor ? "hsl(var(--foreground))" : "hsl(var(--border))" }}
              >
                ✕
              </button>
            </div>
            {cor && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="w-4 h-4 rounded-full inline-block" style={{ background: cor }} />
                Cor selecionada: {cor}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
