import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Loader2, ArrowDownToLine, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLiderancas } from "@/hooks/useSupabaseData";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

interface Props {
  lideranca: Tables<"liderancas">;
  trigger?: React.ReactNode;
}

/**
 * Migra um registro de Líder para Cabo Eleitoral.
 * Atenção: a liderança original é removida — captações e dobradinhas com FK
 * cascateiam conforme regras do banco. Se houver vínculos, alertamos.
 */
export default function MigrarParaCaboDialog({ lideranca, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [liderDest, setLiderDest] = useState("");
  const [busy, setBusy] = useState(false);
  const [vinculos, setVinculos] = useState<{ captados: number; dobradinhas: number } | null>(null);
  const { data: liderancas = [] } = useLiderancas();
  const qc = useQueryClient();

  const opts = useMemo(
    () => [
      { value: "", label: "Selecione o Líder…" },
      ...liderancas
        .filter(l => l.id !== lideranca.id)
        .slice()
        .sort((a, b) => a.nome.localeCompare(b.nome))
        .map(l => ({ value: l.id, label: l.nome })),
    ],
    [liderancas, lideranca.id]
  );

  async function checarVinculos() {
    const [cap, dob] = await Promise.all([
      supabase.from("eleitores_captados").select("id", { count: "exact", head: true }).eq("lideranca_id", lideranca.id),
      supabase.from("dobradinhas").select("id", { count: "exact", head: true }).eq("lideranca_id", lideranca.id),
    ]);
    setVinculos({ captados: cap.count || 0, dobradinhas: dob.count || 0 });
  }

  async function handleOpen(o: boolean) {
    setOpen(o);
    if (o) {
      setLiderDest("");
      setVinculos(null);
      checarVinculos();
    }
  }

  async function handleMigrar() {
    if (!liderDest) {
      toast.error("Selecione o Líder responsável");
      return;
    }
    setBusy(true);
    try {
      const l: any = lideranca;
      const bairros: string[] = Array.isArray(l.bairros) ? l.bairros : [];
      const obsBase = l.observacoes || l.historico_politico || null;
      const bairrosExtras = bairros.slice(1).join(", ");
      const observacoesFinal = [obsBase, bairrosExtras ? `Outros bairros: ${bairrosExtras}` : null]
        .filter(Boolean).join(" | ") || null;
      // Snapshot completo do cadastro do líder — preserva tudo que o cabo suporta.
      const snap = {
        nome: lideranca.nome,
        lider_id: liderDest,
        telefone: lideranca.telefone,
        whatsapp: lideranca.whatsapp,
        cidade_base_id: lideranca.cidade_base_id,
        bairro: bairros[0] || null,
        votos_estimados: lideranca.votos_estimados || 0,
        observacoes: observacoesFinal,
      };
      // Remove primeiro para liberar o telefone da validação de unicidade,
      // já que se trata de conversão do mesmo registro.
      const { error: delErr } = await supabase.from("liderancas").delete().eq("id", lideranca.id);
      if (delErr) throw delErr;
      const { error: insErr } = await supabase.from("cabos_eleitorais").insert(snap);
      if (insErr) {
        // Tenta restaurar o líder para não perder o cadastro.
        await supabase.from("liderancas").insert({
          id: lideranca.id,
          nome: lideranca.nome,
          telefone: lideranca.telefone,
          whatsapp: lideranca.whatsapp,
          cidade_base_id: lideranca.cidade_base_id,
          votos_estimados: lideranca.votos_estimados || 0,
          observacoes: lideranca.observacoes,
          historico_politico: lideranca.historico_politico,
        } as any);
        throw insErr;
      }
      toast.success(`"${lideranca.nome}" migrado para Cabo Eleitoral`);
      qc.invalidateQueries({ queryKey: ["liderancas"] });
      qc.invalidateQueries({ queryKey: ["cabos_eleitorais"] });
      qc.invalidateQueries({ queryKey: ["coordenadores_regionais"] });
      setOpen(false);
    } catch (e: any) {
      toast.error(e.message || "Erro ao migrar");
    } finally {
      setBusy(false);
    }
  }

  const temVinculo = vinculos && (vinculos.captados > 0 || vinculos.dobradinhas > 0);

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="sm" variant="outline">
            <ArrowDownToLine className="h-3.5 w-3.5 mr-1" /> Migrar para Cabo
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Migrar Líder → Cabo Eleitoral</DialogTitle>
          <DialogDescription>
            "{lideranca.nome}" será convertido em Cabo Eleitoral vinculado ao Líder escolhido.
            A entrada original como Líder será removida.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">Líder responsável *</label>
            <NativeSelect value={liderDest} onChange={e => setLiderDest(e.target.value)} options={opts} className="mt-1" />
          </div>
          {temVinculo && (
            <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-sm space-y-1">
              <p className="font-semibold flex items-center gap-1 text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4" /> Esta liderança possui vínculos
              </p>
              {vinculos!.captados > 0 && <p>• {vinculos!.captados} eleitor(es) captado(s) — serão removidos junto.</p>}
              {vinculos!.dobradinhas > 0 && <p>• {vinculos!.dobradinhas} dobradinha(s) — serão removidas junto.</p>}
              <p className="text-xs text-muted-foreground mt-1">
                Se quiser preservar, transfira os vínculos antes (edite captações/dobradinhas para outro Líder).
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={handleMigrar} disabled={busy || !liderDest}>
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Migrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
