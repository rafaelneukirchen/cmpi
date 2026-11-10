import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { NativeSelect } from "@/components/ui/native-select";
import { SearchSelect } from "@/components/ui/search-select";
import { supabase } from "@/integrations/supabase/client";
import { useCidades, useLiderancas } from "@/hooks/useSupabaseData";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Loader2 } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

const schema = z.object({
  cidade_id: z.string().uuid("Selecione uma cidade"),
  lideranca_id: z.string().optional().or(z.literal("")),
  data_visita: z.string().min(1, "Informe a data"),
  equipe_responsavel: z.string().max(200).optional().or(z.literal("")),
  objetivo: z.string().max(500).optional().or(z.literal("")),
  resultado: z.string().max(500).optional().or(z.literal("")),
  relatorio: z.string().max(2000).optional().or(z.literal("")),
  endereco: z.string().max(300).optional().or(z.literal("")),
  bairro: z.string().max(100).optional().or(z.literal("")),
  local_referencia: z.string().max(200).optional().or(z.literal("")),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  visita?: Tables<"visitas_campanha"> | null;
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

export default function VisitaFormDialog({ visita, trigger, onSuccess }: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const { data: cidades = [] } = useCidades();
  const { data: liderancas = [] } = useLiderancas();
  const queryClient = useQueryClient();
  const isEdit = !!visita;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      cidade_id: visita?.cidade_id || "",
      lideranca_id: visita?.lideranca_id || "",
      data_visita: visita?.data_visita || "",
      equipe_responsavel: visita?.equipe_responsavel || "",
      objetivo: visita?.objetivo || "",
      resultado: visita?.resultado || "",
      relatorio: visita?.relatorio || "",
      endereco: (visita as any)?.endereco || "",
      bairro: (visita as any)?.bairro || "",
      local_referencia: (visita as any)?.local_referencia || "",
    },
  });

  async function onSubmit(values: FormValues) {
    setSaving(true);
    try {
      const payload: any = {
        cidade_id: values.cidade_id,
        lideranca_id: values.lideranca_id || null,
        data_visita: values.data_visita,
        equipe_responsavel: values.equipe_responsavel || null,
        objetivo: values.objetivo || null,
        resultado: values.resultado || null,
        relatorio: values.relatorio || null,
        endereco: values.endereco || null,
        bairro: values.bairro || null,
        local_referencia: values.local_referencia || null,
      };

      if (isEdit && visita) {
        const { error } = await supabase.from("visitas_campanha").update(payload).eq("id", visita.id);
        if (error) throw error;
        toast.success("Visita atualizada!");
      } else {
        const { error } = await supabase.from("visitas_campanha").insert(payload);
        if (error) throw error;
        toast.success("Visita registrada!");
      }

      setOpen(false);
      form.reset();
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["visitas"] });
        onSuccess?.();
      }, 150);
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  const cidadeOptions = cidades.map(c => ({ value: c.id, label: c.nome }));
  const liderancaOptions = [
    { value: "", label: "Nenhuma" },
    ...liderancas.map(l => ({ value: l.id, label: l.nome })),
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Nova Visita
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[calc(100dvh-1rem)] overflow-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar Visita" : "Nova Visita"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="cidade_id" render={({ field }) => (
              <FormItem>
                <FormLabel>Cidade *</FormLabel>
                <FormControl>
                  <SearchSelect value={field.value} onChange={(v) => field.onChange(v)} options={cidadeOptions} placeholder="Selecione..." searchPlaceholder="Buscar cidade..." />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="lideranca_id" render={({ field }) => (
              <FormItem>
                <FormLabel>Liderança</FormLabel>
                <FormControl>
                  <SearchSelect value={field.value || ""} onChange={(v) => field.onChange(v)} options={liderancaOptions} placeholder="Selecione..." searchPlaceholder="Buscar liderança..." allowClear />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField control={form.control} name="data_visita" render={({ field }) => (
                <FormItem>
                  <FormLabel>Data *</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="equipe_responsavel" render={({ field }) => (
                <FormItem>
                  <FormLabel>Equipe Responsável</FormLabel>
                  <FormControl><Input placeholder="Nome da equipe" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="border-t pt-4 space-y-4">
              <p className="text-sm font-medium text-muted-foreground">Localização da Visita</p>
              <FormField control={form.control} name="endereco" render={({ field }) => (
                <FormItem>
                  <FormLabel>Endereço</FormLabel>
                  <FormControl><Input placeholder="Rua, número, complemento" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField control={form.control} name="bairro" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bairro</FormLabel>
                    <FormControl><Input placeholder="Bairro" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="local_referencia" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ponto de Referência</FormLabel>
                    <FormControl><Input placeholder="Ex: Em frente ao mercado" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </div>

            <div className="border-t pt-4 space-y-4">
              <p className="text-sm font-medium text-muted-foreground">Detalhes da Visita</p>
              <FormField control={form.control} name="objetivo" render={({ field }) => (
                <FormItem>
                  <FormLabel>Objetivo</FormLabel>
                  <FormControl><Input placeholder="Objetivo da visita" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="resultado" render={({ field }) => (
                <FormItem>
                  <FormLabel>Resultado</FormLabel>
                  <FormControl><Input placeholder="Resultado obtido" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="relatorio" render={({ field }) => (
                <FormItem>
                  <FormLabel>Relatório</FormLabel>
                  <FormControl><Textarea placeholder="Relatório detalhado..." rows={3} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
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
