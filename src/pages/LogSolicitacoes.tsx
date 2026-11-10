import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/logistics/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DeleteConfirmDialog } from "@/components/logistics/DeleteConfirmDialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { useCidades, useLiderancas } from "@/hooks/useSupabaseData";
import { logAudit } from "@/lib/auditLog";
import { Plus, Search, ClipboardList, PackageCheck, ShoppingCart, Truck } from "lucide-react";

const STATUSES = ["Pedido", "Em separação", "Produção", "Enviado", "Entregue", "Cancelada"] as const;
const PRIORIDADES = ["Baixa", "Normal", "Alta", "Urgente"] as const;

const statusColors: Record<string, string> = {
  "Pedido": "bg-amber-500/15 text-amber-600",
  "Pendente": "bg-amber-500/15 text-amber-600",
  "Em separação": "bg-primary/15 text-primary",
  "Produção": "bg-purple-500/15 text-purple-600",
  "Enviado": "bg-blue-500/15 text-blue-600",
  "Entregue": "bg-emerald-500/15 text-emerald-600",
  "Cancelada": "bg-destructive/15 text-destructive",
};

interface FormState {
  id?: string;
  coordenador_nome: string;
  material_id: string;
  quantidade_solicitada: string;
  cidade_id: string;
  lideranca_id: string;
  prioridade: string;
  status: string;
  observacoes: string;
  resposta_logistica: string;
}

const emptyForm: FormState = {
  coordenador_nome: "", material_id: "", quantidade_solicitada: "",
  cidade_id: "", lideranca_id: "", prioridade: "Normal", status: "Pedido",
  observacoes: "", resposta_logistica: "",
};

export default function LogSolicitacoes() {
  const { user, userRole } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  // Apenas a logística (admin) altera o status do pedido.
  const { data: permissions = [] } = useUserPermissions();
  const isLogistica = userRole === "admin" || permissions.includes("log_solicitacoes_gestao");
  const isAdmin = userRole === "admin";

  const { data: cidades = [] } = useCidades();
  const { data: liderancas = [] } = useLiderancas();

  const { data: materials = [] } = useQuery({
    queryKey: ["log-materials-options"],
    queryFn: async () => {
      const { data, error } = await supabase.from("materials").select("id, name, available_qty").order("name");
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["material-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("material_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const [meuNome, setMeuNome] = useState("");
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("nome").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      if (data?.nome) setMeuNome(data.nome);
    });
  }, [user]);

  // Atualização em tempo real dos pedidos (chegou = aparece na hora)
  useEffect(() => {
    const channel = supabase
      .channel("material-requests-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "material_requests" }, () => {
        queryClient.invalidateQueries({ queryKey: ["material-requests"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);


  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const update = (k: keyof FormState, v: string) => setForm(p => ({ ...p, [k]: v }));

  const openNew = () => {
    setForm({ ...emptyForm, coordenador_nome: meuNome });
    setOpen(true);
  };

  const openEdit = (r: any) => {
    setForm({
      id: r.id,
      coordenador_nome: r.coordenador_nome || "",
      material_id: r.material_id || "",
      quantidade_solicitada: String(r.quantidade_solicitada ?? ""),
      cidade_id: r.cidade_id || "",
      lideranca_id: r.lideranca_id || "",
      prioridade: r.prioridade || "Normal",
      status: r.status || "Pedido",
      observacoes: r.observacoes || "",
      resposta_logistica: r.resposta_logistica || "",
    });
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.coordenador_nome.trim() || !form.material_id || !form.quantidade_solicitada || !form.cidade_id) {
      toast({ title: "Preencha coordenador, material, quantidade e cidade de destino", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const material = materials.find((m: any) => m.id === form.material_id);
      const cidade = cidades.find((c: any) => c.id === form.cidade_id);
      const lider = liderancas.find((l: any) => l.id === form.lideranca_id);
      const payload: any = {
        coordenador_nome: form.coordenador_nome.trim(),
        material_id: form.material_id,
        material_nome: material?.name || null,
        quantidade_solicitada: parseInt(form.quantidade_solicitada, 10) || 1,
        cidade_id: form.cidade_id,
        cidade_destino: cidade?.nome || "",
        lideranca_id: form.lideranca_id || null,
        lideranca_nome: lider?.nome || null,
        prioridade: form.prioridade,
        status: form.status,
        observacoes: form.observacoes || null,
        resposta_logistica: form.resposta_logistica || null,
      };

      if (form.id) {
        const { error } = await supabase.from("material_requests").update(payload).eq("id", form.id);
        if (error) throw error;
        await logAudit("UPDATE", "material_requests", form.id, { status: form.status });
        toast({ title: "Solicitação atualizada!" });
      } else {
        payload.solicitante_user_id = user?.id;
        payload.status = "Pedido";
        const { data, error } = await supabase.from("material_requests").insert(payload).select().single();
        if (error) throw error;
        await logAudit("INSERT", "material_requests", (data as any).id, payload);
        toast({
          title: `Pedido #${(data as any).numero_pedido} enviado!`,
          description: "A solicitação chegou na logística e os administradores foram avisados.",
        });
      }
      setOpen(false);
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ["material-requests"] }), 150);
    } catch (err: any) {
      toast({ title: "Erro ao salvar solicitação", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("material_requests").update({ status } as any).eq("id", id);
    if (error) {
      toast({ title: "Erro ao atualizar status", description: error.message, variant: "destructive" });
      return;
    }
    await logAudit("UPDATE", "material_requests", id, { status });
    queryClient.invalidateQueries({ queryKey: ["material-requests"] });
    toast({ title: `Status: ${status}` });
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("material_requests").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
      return;
    }
    await logAudit("DELETE", "material_requests", id, {});
    queryClient.invalidateQueries({ queryKey: ["material-requests"] });
    toast({ title: "Solicitação excluída!" });
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase().replace("#", "");
    return requests.filter((r: any) => {
      if (statusFilter && r.status !== statusFilter) return false;
      if (!q) return true;
      return [r.coordenador_nome, r.material_nome, r.cidade_destino, r.lideranca_nome, String(r.numero_pedido ?? "")]
        .some((v: string) => (v || "").toLowerCase().includes(q));
    });
  }, [requests, search, statusFilter]);


  const stats = useMemo(() => ({
    total: requests.length,
    pendentes: requests.filter((r: any) => r.status === "Pedido" || r.status === "Pendente").length,
    comprar: requests.filter((r: any) => r.status === "Produção" || r.status === "Comprar").length,
    enviados: requests.filter((r: any) => r.status === "Enviado" || r.status === "Entregue").length,
  }), [requests]);

  return (
    <div className="space-y-4 sm:space-y-6 max-w-7xl">
      <PageHeader title="Solicitações de Material" description="Pedidos da coordenação para separação, compra ou envio">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" onClick={openNew}><Plus className="w-4 h-4" /> Nova Solicitação</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>{form.id ? "Editar Solicitação" : "Nova Solicitação de Material"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-3 pr-1">
              <div className="space-y-1.5">
                <Label>Coordenador solicitante *</Label>
                <Input value={form.coordenador_nome} onChange={e => update("coordenador_nome", e.target.value)} maxLength={120} placeholder="Nome do coordenador" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Material *</Label>
                  <NativeSelect
                    value={form.material_id}
                    onChange={e => update("material_id", e.target.value)}
                    options={[
                      { value: "", label: "Selecione o material" },
                      ...materials.map((m: any) => ({ value: m.id, label: `${m.name} (disp: ${m.available_qty ?? 0})` })),
                    ]}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Quantidade solicitada *</Label>
                  <Input type="number" min="1" value={form.quantidade_solicitada} onChange={e => update("quantidade_solicitada", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Prioridade</Label>
                  <NativeSelect
                    value={form.prioridade}
                    onChange={e => update("prioridade", e.target.value)}
                    options={PRIORIDADES.map(p => ({ value: p, label: p }))}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Cidade de destino *</Label>
                  <NativeSelect
                    value={form.cidade_id}
                    onChange={e => update("cidade_id", e.target.value)}
                    options={[
                      { value: "", label: "Selecione a cidade" },
                      ...cidades.map((c: any) => ({ value: c.id, label: c.nome })),
                    ]}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Liderança responsável</Label>
                  <NativeSelect
                    value={form.lideranca_id}
                    onChange={e => update("lideranca_id", e.target.value)}
                    options={[
                      { value: "", label: "Selecione a liderança" },
                      ...liderancas.map((l: any) => ({ value: l.id, label: l.nome })),
                    ]}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Status do pedido</Label>
                  {isLogistica ? (
                    <NativeSelect
                      value={form.status}
                      onChange={e => update("status", e.target.value)}
                      options={STATUSES.map(s => ({ value: s, label: s }))}
                    />
                  ) : (
                    <div>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium inline-block ${statusColors[form.status] || "bg-muted text-muted-foreground"}`}>
                        {form.status || "Pedido"}
                      </span>
                      <p className="text-xs text-muted-foreground mt-1">
                        O status é atualizado pela logística. Você acompanha a situação por aqui.
                      </p>
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Observações</Label>
                <Textarea value={form.observacoes} onChange={e => update("observacoes", e.target.value)} maxLength={500} rows={2} />
              </div>
              {isLogistica ? (
                <div className="space-y-1.5">
                  <Label>Resposta da logística</Label>
                  <Textarea value={form.resposta_logistica} onChange={e => update("resposta_logistica", e.target.value)} maxLength={500} rows={2} placeholder="Ex.: separado, comprado em 10/08, enviado por transportadora..." />
                </div>
              ) : form.resposta_logistica ? (
                <div className="space-y-1.5">
                  <Label>Resposta da logística</Label>
                  <p className="text-sm rounded-md border bg-muted/40 p-2">{form.resposta_logistica}</p>
                </div>
              ) : null}
              <DialogFooter className="pt-2">
                <Button type="submit" className="w-full" disabled={saving}>
                  {saving ? "Salvando..." : form.id ? "Salvar alterações" : "Enviar solicitação"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total", value: stats.total, icon: ClipboardList },
          { label: "Pedidos abertos", value: stats.pendentes, icon: PackageCheck },
          { label: "Em produção", value: stats.comprar, icon: ShoppingCart },
          { label: "Enviados/Entregues", value: stats.enviados, icon: Truck },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center text-primary shrink-0">
                <s.icon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-lg font-bold">{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nº do pedido, coordenador, material, cidade ou liderança..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <NativeSelect
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="w-full sm:w-52"
          options={[{ value: "", label: "Todos os status" }, ...STATUSES.map(s => ({ value: s, label: s }))]}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Pedido</TableHead>
                  <TableHead>Recebido em</TableHead>
                  <TableHead>Coordenador</TableHead>
                  <TableHead>Material</TableHead>
                  <TableHead className="text-right">Qtd.</TableHead>
                  <TableHead>Cidade destino</TableHead>
                  <TableHead>Liderança</TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-32">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono font-semibold text-primary">#{r.numero_pedido}</TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {r.created_at ? new Date(r.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "-"}
                    </TableCell>
                    <TableCell className="font-medium">{r.coordenador_nome}</TableCell>
                    <TableCell>{r.material_nome || "-"}</TableCell>

                    <TableCell className="text-right">{(r.quantidade_solicitada || 0).toLocaleString("pt-BR")}</TableCell>
                    <TableCell>{r.cidade_destino}</TableCell>
                    <TableCell>{r.lideranca_nome || "-"}</TableCell>
                    <TableCell>{r.prioridade}</TableCell>
                    <TableCell>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[r.status] || "bg-muted text-muted-foreground"}`}>{r.status}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 flex-wrap">
                        {isLogistica && (
                          <NativeSelect
                            value={r.status}
                            onChange={e => changeStatus(r.id, e.target.value)}
                            className="h-8 text-xs w-32"
                            options={STATUSES.map(s => ({ value: s, label: s }))}
                          />
                        )}
                        <Button size="sm" variant="ghost" className="h-8" onClick={() => openEdit(r)}>Editar</Button>
                        {isAdmin && (
                          <DeleteConfirmDialog
                            title="Excluir Solicitação"
                            description="Deseja excluir esta solicitação de material?"
                            onConfirm={() => handleDelete(r.id)}
                          />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!isLoading && filtered.length === 0 && (
                  <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">Nenhuma solicitação encontrada</TableCell></TableRow>
                )}
                {isLoading && (
                  <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
