import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { supabase } from "@/integrations/supabase/client";
import { useCidades, useLiderancas } from "@/hooks/useSupabaseData";
import { useCoordenadores } from "@/hooks/useCoordenadores";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Loader2 } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

const schema = z.object({
  cidade_id: z.string().uuid("Selecione uma cidade"),
  lideranca_id: z.string().optional().or(z.literal("")),
  votos_projetados: z.coerce.number().int().min(0).default(0),
  votos_confirmados: z.coerce.number().int().min(0).default(0),
  meta_votos: z.coerce.number().int().min(0).default(0),
  nivel_confianca: z.enum(["baixo", "medio", "alto"]),
  responsavel: z.string().max(200).optional().or(z.literal("")),
  observacoes: z.string().max(2000).optional().or(z.literal("")),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  projecao?: Tables<"projecao_votos"> | null;
  defaultCidadeId?: string;
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

export default function ProjecaoFormDialog({ projecao, defaultCidadeId, trigger, onSuccess }: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const { data: cidades = [] } = useCidades();
  const { data: liderancas = [] } = useLiderancas();
  const { data: coordenadores = [] } = useCoordenadores();
  const queryClient = useQueryClient();
  const isEdit = !!projecao;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      cidade_id: projecao?.cidade_id || defaultCidadeId || "",
      lideranca_id: projecao?.lideranca_id || "",
      votos_projetados: projecao?.votos_projetados || 0,
      votos_confirmados: projecao?.votos_confirmados || 0,
      meta_votos: projecao?.meta_votos || 0,
      nivel_confianca: (projecao?.nivel_confianca as FormValues["nivel_confianca"]) || "medio",
      responsavel: projecao?.responsavel || "",
      observacoes: projecao?.observacoes || "",
    },
  });

  async function onSubmit(values: FormValues) {
    setSaving(true);
    try {
      const payload = {
        cidade_id: values.cidade_id,
        lideranca_id: values.lideranca_id && values.lideranca_id !== "" ? values.lideranca_id : null,
        votos_projetados: values.votos_projetados,
        votos_confirmados: values.votos_confirmados,
        meta_votos: values.meta_votos,
        nivel_confianca: values.nivel_confianca as "baixo" | "medio" | "alto",
        responsavel: values.responsavel || null,
        observacoes: values.observacoes || null,
        data_atualizacao: new Date().toISOString().split("T")[0],
      };

      if (isEdit && projecao) {
        const { error } = await supabase.from("projecao_votos").update(payload).eq("id", projecao.id);
        if (error) throw error;
        toast.success("Projeção atualizada!");
      } else {
        const { error } = await supabase.from("projecao_votos").insert(payload);
        if (error) throw error;
        toast.success("Projeção cadastrada!");
      }

      setOpen(false);
      form.reset();
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["projecoes"] });
        onSuccess?.();
      }, 150);
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar projeção");
    } finally {
      setSaving(false);
    }
  }

  const cidadeOptions = cidades.map(c => ({ value: c.id, label: c.nome }));
  const liderancaOptions = [
    { value: "", label: "Nenhuma" },
    ...liderancas.map(l => ({ value: l.id, label: l.nome })),
  ];
  const confiancaOptions = [
    { value: "baixo", label: "Baixo" },
    { value: "medio", label: "Médio" },
    { value: "alto", label: "Alto" },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="sm" variant="outline">
            <Plus className="h-4 w-4 mr-1" />
            Nova Projeção
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[calc(100dvh-1rem)] overflow-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar Projeção" : "Nova Projeção de Apoiadores"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="cidade_id" render={({ field }) => (
              <FormItem>
                <FormLabel>Cidade *</FormLabel>
                <FormControl>
                  <NativeSelect value={field.value} onChange={(e) => field.onChange(e.target.value)} options={cidadeOptions} placeholder="Selecione a cidade" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="lideranca_id" render={({ field }) => (
              <FormItem>
                <FormLabel>Liderança Responsável</FormLabel>
                <FormControl>
                  <NativeSelect value={field.value || ""} onChange={(e) => field.onChange(e.target.value)} options={liderancaOptions} placeholder="Nenhuma (opcional)" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <FormField control={form.control} name="votos_projetados" render={({ field }) => (
                <FormItem>
                  <FormLabel>Projetados</FormLabel>
                  <FormControl><Input type="number" min={0} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="votos_confirmados" render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirmados</FormLabel>
                  <FormControl><Input type="number" min={0} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="meta_votos" render={({ field }) => (
                <FormItem>
                  <FormLabel>Meta</FormLabel>
                  <FormControl><Input type="number" min={0} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField control={form.control} name="nivel_confianca" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nível de Confiança *</FormLabel>
                  <FormControl>
                    <NativeSelect value={field.value} onChange={(e) => field.onChange(e.target.value)} options={confiancaOptions} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="responsavel" render={({ field }) => (
                <FormItem>
                  <FormLabel>Responsável</FormLabel>
                  <FormControl>
                    <NativeSelect
                      value={field.value || ""}
                      onChange={(e) => field.onChange(e.target.value)}
                      options={[
                        { value: "", label: "Nenhum" },
                        ...coordenadores.map(c => ({ value: c.nome, label: c.nome })),
                      ]}
                      placeholder="Selecione o coordenador"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="observacoes" render={({ field }) => (
              <FormItem>
                <FormLabel>Observações</FormLabel>
                <FormControl><Textarea placeholder="Observações..." rows={2} {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

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
