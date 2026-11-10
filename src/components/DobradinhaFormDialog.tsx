import { useState, useMemo, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { SearchSelect } from "@/components/ui/search-select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { supabase } from "@/integrations/supabase/client";
import { useLiderancas } from "@/hooks/useSupabaseData";
import { useCidadesOptions } from "@/hooks/useCidadesOptions";
import { useCoordenadores } from "@/hooks/useCoordenadores";
import { useCabosEleitorais } from "@/hooks/useCabosEleitorais";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Loader2 } from "lucide-react";
import type { Dobradinha } from "@/hooks/useDobradinhas";

const schema = z.object({
  vinculo_tipo: z.enum(["lider", "cabo"]).default("lider"),
  lideranca_id: z.string().optional().or(z.literal("")),
  cabo_id: z.string().optional().or(z.literal("")),
  cidade_id: z.string().optional().or(z.literal("")),
  coordenador_user_id: z.string().optional().or(z.literal("")),
  candidato_parceiro: z.string().trim().min(2, "Nome do candidato deve ter pelo menos 2 caracteres").max(200),
  cargo_parceiro: z.string().max(100).optional().or(z.literal("")),
  votos_estimados: z.coerce.number().int().min(0).default(0),
  observacoes: z.string().max(2000).optional().or(z.literal("")),
}).refine(v => (v.vinculo_tipo === "lider" ? !!v.lideranca_id : !!v.cabo_id), {
  message: "Selecione o vínculo (Líder ou Cabo Eleitoral)",
  path: ["lideranca_id"],
});

type FormValues = z.infer<typeof schema>;

interface Props {
  dobradinha?: Dobradinha | null;
  defaultCidadeId?: string;
  defaultLiderancaId?: string;
  defaultCaboId?: string;
  tsePrefill?: { nome: string; votos: number } | null;
  autoOpen?: boolean;
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

function LiderancaNativeSelect({ value, onChange, liderancas, cidadeMap }: {
  value: string;
  onChange: (id: string) => void;
  liderancas: { id: string; nome: string; cidade_base_id: string | null }[];
  cidadeMap: Map<string, { nome: string }>;
}) {
  const options = useMemo(() => liderancas.map(l => ({
    value: l.id,
    label: `${l.nome}${l.cidade_base_id && cidadeMap.get(l.cidade_base_id) ? ` (${cidadeMap.get(l.cidade_base_id)!.nome})` : ""}`,
  })), [liderancas, cidadeMap]);

  return (
    <SearchSelect
      value={value || ""}
      onChange={(v) => onChange(v)}
      options={options}
      placeholder="Selecione a liderança..."
      searchPlaceholder="Buscar liderança..."
    />
  );
}

export default function DobradinhaFormDialog({
  dobradinha,
  defaultCidadeId,
  defaultLiderancaId,
  defaultCaboId,
  tsePrefill,
  autoOpen,
  trigger,
  onSuccess,
}: Props) {
  const [open, setOpen] = useState(autoOpen || false);
  const [saving, setSaving] = useState(false);
  const { data: cidades = [] } = useCidadesOptions();
  const { data: liderancas = [] } = useLiderancas();
  const { data: cabos = [] } = useCabosEleitorais();
  const { data: coordenadores = [] } = useCoordenadores();
  const queryClient = useQueryClient();
  const isEdit = !!dobradinha;

  const cidadeMap = useMemo(() => new Map(cidades.map(c => [c.id, c])), [cidades]);

  const initialVinculo: "lider" | "cabo" =
    (dobradinha as any)?.cabo_id || defaultCaboId ? "cabo" : "lider";

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      vinculo_tipo: initialVinculo,
      lideranca_id: dobradinha?.lideranca_id || defaultLiderancaId || "",
      cabo_id: (dobradinha as any)?.cabo_id || defaultCaboId || "",
      cidade_id: dobradinha?.cidade_id || defaultCidadeId || "",
      coordenador_user_id: (dobradinha as any)?.coordenador_user_id || "",
      candidato_parceiro: tsePrefill?.nome || dobradinha?.candidato_parceiro || "",
      cargo_parceiro: dobradinha?.cargo_parceiro || "",
      votos_estimados: tsePrefill?.votos || dobradinha?.votos_estimados || 0,
      observacoes: dobradinha?.observacoes || "",
    },
  });

  const vinculoTipo = form.watch("vinculo_tipo");
  const selectedLiderancaId = form.watch("lideranca_id");
  const selectedCaboId = form.watch("cabo_id");

  // Auto-set cidade_id from lider/cabo
  useEffect(() => {
    if (vinculoTipo === "lider" && selectedLiderancaId) {
      const lid = liderancas.find(l => l.id === selectedLiderancaId);
      if (lid?.cidade_base_id) form.setValue("cidade_id", lid.cidade_base_id);
    } else if (vinculoTipo === "cabo" && selectedCaboId) {
      const cabo = cabos.find(c => c.id === selectedCaboId);
      if (cabo?.cidade_base_id) form.setValue("cidade_id", cabo.cidade_base_id);
    }
  }, [vinculoTipo, selectedLiderancaId, selectedCaboId, liderancas, cabos, form]);

  const cidadeAutoNome = useMemo(() => {
    if (vinculoTipo === "lider" && selectedLiderancaId) {
      const lid = liderancas.find(l => l.id === selectedLiderancaId);
      if (lid?.cidade_base_id) return cidadeMap.get(lid.cidade_base_id)?.nome;
    }
    if (vinculoTipo === "cabo" && selectedCaboId) {
      const cabo = cabos.find(c => c.id === selectedCaboId);
      if (cabo?.cidade_base_id) return cidadeMap.get(cabo.cidade_base_id)?.nome;
    }
    return null;
  }, [vinculoTipo, selectedLiderancaId, selectedCaboId, liderancas, cabos, cidadeMap]);

  const caboOptions = useMemo(() => cabos.map(c => {
    const cid = c.cidade_base_id ? cidadeMap.get(c.cidade_base_id) : null;
    return { value: c.id, label: `${c.nome}${cid ? ` (${cid.nome})` : ""}` };
  }), [cabos, cidadeMap]);

  async function onSubmit(values: FormValues) {
    setSaving(true);
    try {
      let cidadeId: string | null = values.cidade_id || null;
      if (values.vinculo_tipo === "lider" && values.lideranca_id) {
        const lid = liderancas.find(l => l.id === values.lideranca_id);
        cidadeId = lid?.cidade_base_id || cidadeId;
      } else if (values.vinculo_tipo === "cabo" && values.cabo_id) {
        const cabo = cabos.find(c => c.id === values.cabo_id);
        cidadeId = cabo?.cidade_base_id || cidadeId;
      }

      const payload = {
        cidade_id: cidadeId,
        lideranca_id: values.vinculo_tipo === "lider" ? (values.lideranca_id || null) : null,
        cabo_id: values.vinculo_tipo === "cabo" ? (values.cabo_id || null) : null,
        coordenador_user_id: values.coordenador_user_id || null,
        candidato_parceiro: values.candidato_parceiro,
        cargo_parceiro: values.cargo_parceiro || null,
        votos_estimados: values.votos_estimados,
        observacoes: values.observacoes || null,
      };

      if (isEdit && dobradinha) {
        const { error } = await supabase.from("dobradinhas").update(payload).eq("id", dobradinha.id);
        if (error) throw error;
        toast.success("Dobrada atualizada com sucesso!");
      } else {
        const { error } = await supabase.from("dobradinhas").insert(payload);
        if (error) throw error;
        toast.success("Dobrada cadastrada com sucesso!");
      }

      setOpen(false);
      form.reset();
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["dobradinhas"] });
        onSuccess?.();
      }, 150);
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar dobradinha");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Nova Dobrada
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[calc(100dvh-1rem)] overflow-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar Dobrada" : "Nova Dobrada"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="candidato_parceiro"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Candidato Parceiro (Dobrada) *</FormLabel>
                  <FormControl>
                    <Input placeholder="Nome do candidato da dobradinha" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="cargo_parceiro"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cargo do Parceiro</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Vereador, Deputado Estadual..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="vinculo_tipo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vincular a *</FormLabel>
                  <FormControl>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => { field.onChange("lider"); form.setValue("cabo_id", ""); }}
                        className={`rounded-md border px-3 py-2 text-sm font-medium transition ${field.value === "lider" ? "border-primary bg-primary/10 text-primary" : "border-input hover:bg-accent"}`}
                      >
                        Líder
                      </button>
                      <button
                        type="button"
                        onClick={() => { field.onChange("cabo"); form.setValue("lideranca_id", ""); }}
                        className={`rounded-md border px-3 py-2 text-sm font-medium transition ${field.value === "cabo" ? "border-primary bg-primary/10 text-primary" : "border-input hover:bg-accent"}`}
                      >
                        Cabo Eleitoral
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {vinculoTipo === "lider" ? (
              <FormField
                control={form.control}
                name="lideranca_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Líder Vinculado *</FormLabel>
                    <FormControl>
                      <LiderancaNativeSelect
                        value={field.value}
                        onChange={field.onChange}
                        liderancas={liderancas}
                        cidadeMap={cidadeMap}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : (
              <FormField
                control={form.control}
                name="cabo_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cabo Eleitoral Vinculado *</FormLabel>
                    <FormControl>
                      <SearchSelect
                        value={field.value || ""}
                        onChange={v => field.onChange(v)}
                        options={caboOptions}
                        placeholder="Selecione o cabo eleitoral..."
                        searchPlaceholder="Buscar cabo..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {cidadeAutoNome && (
              <div className="rounded-md bg-muted px-3 py-2 text-sm">
                <span className="text-muted-foreground">Cidade vinculada: </span>
                <strong>{cidadeAutoNome}</strong>
              </div>
            )}

            <FormField
              control={form.control}
              name="coordenador_user_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Coordenador Responsável</FormLabel>
                  <FormControl>
                    <SearchSelect
                      value={field.value || ""}
                      onChange={v => field.onChange(v)}
                      options={coordenadores.map(c => ({ value: c.user_id, label: c.nome }))}
                      placeholder="Nenhum"
                      searchPlaceholder="Buscar coordenador..."
                      allowClear
                      clearLabel="Nenhum"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="votos_estimados"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Apoiadores Estimados da Dobrada *</FormLabel>
                  <FormControl>
                    <Input type="number" min={0} placeholder="Quantidade de apoiadores" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="observacoes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Observações sobre a dobradinha..." rows={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                {isEdit ? "Salvar" : "Cadastrar"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
