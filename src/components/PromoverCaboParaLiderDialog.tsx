import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowUpToLine } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

interface Props {
  cabo: Tables<"cabos_eleitorais">;
  trigger?: React.ReactNode;
}

/**
 * Promove um Cabo Eleitoral a Liderança, preservando o cadastro
 * (cidade, bairros, votos por cidade, observações, etc.).
 * O registro original de cabo é removido para liberar o telefone único.
 */
export default function PromoverCaboParaLiderDialog({ cabo, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();

  async function handlePromover() {
    setBusy(true);
    try {
      const c: any = cabo;
      const snap: any = {
        nome: c.nome,
        telefone: c.telefone,
        whatsapp: c.whatsapp,
        cidade_base_id: c.cidade_base_id,
        bairros: Array.isArray(c.bairros) ? c.bairros : (c.bairro ? [c.bairro] : []),
        cidades_representadas: Array.isArray(c.cidades_representadas) ? c.cidades_representadas : [],
        votos_estimados: c.votos_estimados || 0,
        votos_por_cidade: c.votos_por_cidade || {},
        zonas_por_cidade: c.zonas_por_cidade || {},
        forca_politica: c.forca_politica || "media",
        historico_politico: c.historico_politico || null,
        observacoes: c.observacoes || null,
        status: c.status || "ativa",
        coordenador_user_id: c.coordenador_user_id || null,
        promoted_from_origem: "cabo_eleitoral",
        promoted_from_id: c.id,
      };
      // Remove primeiro para liberar telefone da validação de unicidade
      const { error: delErr } = await supabase.from("cabos_eleitorais").delete().eq("id", cabo.id);
      if (delErr) throw delErr;
      const { error: insErr } = await supabase.from("liderancas").insert(snap);
      if (insErr) {
        // rollback
        await supabase.from("cabos_eleitorais").insert({
          id: c.id, nome: c.nome, lider_id: c.lider_id, telefone: c.telefone, whatsapp: c.whatsapp,
          cidade_base_id: c.cidade_base_id, bairro: c.bairro, bairros: c.bairros,
          cidades_representadas: c.cidades_representadas, votos_estimados: c.votos_estimados,
          votos_por_cidade: c.votos_por_cidade, zonas_por_cidade: c.zonas_por_cidade,
          forca_politica: c.forca_politica, historico_politico: c.historico_politico,
          observacoes: c.observacoes, status: c.status, coordenador_user_id: c.coordenador_user_id,
        } as any);
        throw insErr;
      }
      toast.success(`"${cabo.nome}" promovido a Liderança`);
      qc.invalidateQueries({ queryKey: ["liderancas"] });
      qc.invalidateQueries({ queryKey: ["cabos_eleitorais"] });
      qc.invalidateQueries({ queryKey: ["coordenadores_regionais"] });
      setOpen(false);
    } catch (e: any) {
      toast.error(e.message || "Erro ao promover");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="sm" variant="outline">
            <ArrowUpToLine className="h-3.5 w-3.5 mr-1" /> Promover a Líder
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Promover Cabo → Liderança</DialogTitle>
          <DialogDescription>
            "{cabo.nome}" será convertido em Liderança. Todos os dados do cadastro
            (cidade, bairros, votos por cidade, observações) serão preservados.
            O registro original como Cabo será removido.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={handlePromover} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Promover
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
