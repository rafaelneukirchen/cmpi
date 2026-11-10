import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { NativeSelect } from "@/components/ui/native-select";
import { SearchSelect } from "@/components/ui/search-select";
import { supabase } from "@/integrations/supabase/client";
import { useCidades } from "@/hooks/useSupabaseData";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Loader2 } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

const schema = z.object({
  cidade_id: z.string().uuid("Selecione uma cidade"),
  cabos_eleitorais: z.coerce.number().int().min(0).default(0),
  apoiadores: z.coerce.number().int().min(0).default(0),
  veiculos: z.coerce.number().int().min(0).default(0),
  materiais_distribuidos: z.coerce.number().int().min(0).default(0),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  estrutura?: Tables<"estrutura_campanha"> | null;
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

export default function EstruturaFormDialog({ estrutura, trigger, onSuccess }: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const { data: cidades = [] } = useCidades();
  const queryClient = useQueryClient();
  const isEdit = !!estrutura;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      cidade_id: estrutura?.cidade_id || "",
      cabos_eleitorais: estrutura?.cabos_eleitorais || 0,
      apoiadores: estrutura?.apoiadores || 0,
      veiculos: estrutura?.veiculos || 0,
      materiais_distribuidos: estrutura?.materiais_distribuidos || 0,
    },
  });

  async function onSubmit(values: FormValues) {
    setSaving(true);
    try {
      const payload = {
        cidade_id: values.cidade_id,
        cabos_eleitorais: values.cabos_eleitorais,
        apoiadores: values.apoiadores,
        veiculos: values.veiculos,
        materiais_distribuidos: values.materiais_distribuidos,
      };

      if (isEdit && estrutura) {
        const { error } = await supabase.from("estrutura_campanha").update(payload).eq("id", estrutura.id);
        if (error) throw error;
        toast.success("Estrutura atualizada!");
      } else {
        const { error } = await supabase.from("estrutura_campanha").insert(payload);
        if (error) throw error;
        toast.success("Estrutura cadastrada!");
      }

      setOpen(false);
      form.reset();
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["estruturas"] });
        onSuccess?.();
      }, 150);
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  const cidadeOptions = cidades.map(c => ({ value: c.id, label: c.nome }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Nova Estrutura
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[calc(100dvh-1rem)] overflow-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar Estrutura" : "Nova Estrutura"}</DialogTitle>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField control={form.control} name="cabos_eleitorais" render={({ field }) => (
                <FormItem>
                  <FormLabel>Cabos Eleitorais</FormLabel>
                  <FormControl><Input type="number" min={0} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="apoiadores" render={({ field }) => (
                <FormItem>
                  <FormLabel>Apoiadores</FormLabel>
                  <FormControl><Input type="number" min={0} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="veiculos" render={({ field }) => (
                <FormItem>
                  <FormLabel>Veículos</FormLabel>
                  <FormControl><Input type="number" min={0} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="materiais_distribuidos" render={({ field }) => (
                <FormItem>
                  <FormLabel>Materiais Distribuídos</FormLabel>
                  <FormControl><Input type="number" min={0} {...field} /></FormControl>
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
