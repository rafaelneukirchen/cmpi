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
import { supabase } from "@/integrations/supabase/client";
import { useCidades } from "@/hooks/useSupabaseData";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Loader2 } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

const schema = z.object({
  cidade_id: z.string().uuid("Selecione uma cidade"),
  evento: z.string().min(2, "Informe o evento").max(200),
  data: z.string().min(1, "Informe a data"),
  tipo_evento: z.enum(["reuniao", "comicio", "visita", "carreata", "debate"]),
  responsavel: z.string().max(200).optional().or(z.literal("")),
  endereco: z.string().max(300).optional().or(z.literal("")),
  bairro: z.string().max(100).optional().or(z.literal("")),
  local_referencia: z.string().max(200).optional().or(z.literal("")),
  finalidade: z.string().max(500).optional().or(z.literal("")),
  observacoes: z.string().max(1000).optional().or(z.literal("")),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  evento?: Tables<"agenda_campanha"> | null;
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

export default function AgendaFormDialog({ evento, trigger, onSuccess }: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const { data: cidades = [] } = useCidades();
  const { userRole } = useAuth();
  const isAdmin = userRole === "admin";
  const queryClient = useQueryClient();
  const isEdit = !!evento;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      cidade_id: evento?.cidade_id || "",
      evento: evento?.evento || "",
      data: evento?.data ? new Date(evento.data).toISOString().slice(0, 16) : "",
      tipo_evento: (evento?.tipo_evento as FormValues["tipo_evento"]) || "reuniao",
      responsavel: evento?.responsavel || "",
      endereco: (evento as any)?.endereco || "",
      bairro: (evento as any)?.bairro || "",
      local_referencia: (evento as any)?.local_referencia || "",
      finalidade: (evento as any)?.finalidade || "",
      observacoes: (evento as any)?.observacoes || "",
    },
  });

  async function onSubmit(values: FormValues) {
    setSaving(true);
    try {
      const payload: any = {
        cidade_id: values.cidade_id,
        evento: values.evento,
        data: new Date(values.data).toISOString(),
        tipo_evento: values.tipo_evento,
        responsavel: values.responsavel || null,
        endereco: values.endereco || null,
        bairro: values.bairro || null,
        local_referencia: values.local_referencia || null,
        finalidade: values.finalidade || null,
        observacoes: values.observacoes || null,
      };

      if (isEdit && evento) {
        const { error } = await supabase.from("agenda_campanha").update(payload).eq("id", evento.id);
        if (error) throw error;
        toast.success("Evento atualizado!");
      } else {
        const { error } = await supabase.from("agenda_campanha").insert(payload);
        if (error) throw error;
        toast.success(isAdmin
          ? "Evento adicionado à agenda!"
          : "Evento enviado para aprovação do administrador.");
      }

      setOpen(false);
      form.reset();
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["agenda"] });
        onSuccess?.();
      }, 150);
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  const cidadeOptions = cidades.map(c => ({ value: c.id, label: c.nome }));
  const tipoOptions = [
    { value: "reuniao", label: "Reunião" },
    { value: "comicio", label: "Comício" },
    { value: "visita", label: "Visita" },
    { value: "carreata", label: "Carreata" },
    { value: "debate", label: "Debate" },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Novo Evento
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[calc(100dvh-1rem)] overflow-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar Evento" : "Novo Evento"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="evento" render={({ field }) => (
              <FormItem>
                <FormLabel>Evento *</FormLabel>
                <FormControl><Input placeholder="Nome do evento" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="cidade_id" render={({ field }) => (
              <FormItem>
                <FormLabel>Cidade *</FormLabel>
                <FormControl>
                  <NativeSelect value={field.value} onChange={(e) => field.onChange(e.target.value)} options={cidadeOptions} placeholder="Selecione..." />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField control={form.control} name="data" render={({ field }) => (
                <FormItem>
                  <FormLabel>Data e Hora *</FormLabel>
                  <FormControl><Input type="datetime-local" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="tipo_evento" render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo *</FormLabel>
                  <FormControl>
                    <NativeSelect value={field.value} onChange={(e) => field.onChange(e.target.value)} options={tipoOptions} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="border-t pt-4 space-y-4">
              <p className="text-sm font-medium text-muted-foreground">Localização</p>
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
                    <FormControl><Input placeholder="Ex: Próximo à praça" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
            </div>

            <div className="border-t pt-4 space-y-4">
              <p className="text-sm font-medium text-muted-foreground">Detalhes</p>
              <FormField control={form.control} name="responsavel" render={({ field }) => (
                <FormItem>
                  <FormLabel>Responsável</FormLabel>
                  <FormControl><Input placeholder="Nome do responsável" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="finalidade" render={({ field }) => (
                <FormItem>
                  <FormLabel>Finalidade</FormLabel>
                  <FormControl><Textarea placeholder="Qual a finalidade deste evento? Ex: Reunião com lideranças locais para alinhamento de estratégia" rows={2} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="observacoes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl><Textarea placeholder="Observações adicionais..." rows={2} {...field} /></FormControl>
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
