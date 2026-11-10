import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { NativeSelect } from "@/components/ui/native-select";
import { toast } from "sonner";
import { Copy, Plus, Trash2, KeyRound, ShieldAlert, ExternalLink, Pencil } from "lucide-react";

type Licenca = {
  id: string;
  chave_licenca: string;
  cliente_nome: string;
  cliente_email: string | null;
  cliente_telefone: string | null;
  cliente_empresa: string | null;
  plano: string;
  status: string;
  data_inicio: string;
  data_validade: string | null;
  valor_pago: number | null;
  forma_pagamento: string | null;
  url_projeto: string | null;
  observacoes: string | null;
  created_at: string;
};

const PLANOS = [
  { value: "basico", label: "Básico" },
  { value: "pro", label: "Pro" },
  { value: "enterprise", label: "Enterprise" },
];
const STATUS = [
  { value: "ativa", label: "Ativa" },
  { value: "suspensa", label: "Suspensa" },
  { value: "expirada", label: "Expirada" },
  { value: "cancelada", label: "Cancelada" },
];

const statusVariant: Record<string, string> = {
  ativa: "bg-primary/10 text-primary border-primary/30",
  suspensa: "bg-accent text-accent-foreground border-border",
  expirada: "bg-destructive/15 text-destructive border-destructive/30",
  cancelada: "bg-muted text-muted-foreground border-border",
};

export default function AdminVendas() {
  const { isSuperAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Licenca | null>(null);
  const [toDelete, setToDelete] = useState<Licenca | null>(null);

  const { data: licencas = [], isLoading } = useQuery({
    queryKey: ["licencas"],
    enabled: isSuperAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("licencas" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Licenca[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (payload: Partial<Licenca> & { id?: string }) => {
      if (payload.id) {
        const { id, ...rest } = payload;
        const { error } = await supabase.from("licencas" as any).update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("licencas" as any).insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Licença atualizada" : "Licença criada");
      setOpen(false);
      setEditing(null);
      setTimeout(() => qc.invalidateQueries({ queryKey: ["licencas"] }), 150);
    },
    onError: (e: any) => toast.error(e.message || "Erro ao salvar"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("licencas" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Licença removida");
      setToDelete(null);
      setTimeout(() => qc.invalidateQueries({ queryKey: ["licencas"] }), 150);
    },
  });

  if (loading) return <div className="p-6">Carregando…</div>;
  if (!isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-6 text-center">
        <ShieldAlert className="h-12 w-12 text-destructive" />
        <h1 className="text-2xl font-bold">Acesso restrito</h1>
        <p className="text-muted-foreground max-w-md">
          Esta área é exclusiva do Super Admin (proprietário do sistema).
        </p>
        <Button onClick={() => navigate("/")}>Voltar ao painel</Button>
      </div>
    );
  }

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast.success("Chave copiada!");
  };

  const stats = {
    total: licencas.length,
    ativas: licencas.filter((l) => l.status === "ativa").length,
    receita: licencas.reduce((s, l) => s + Number(l.valor_pago || 0), 0),
  };

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <KeyRound className="h-7 w-7 text-primary" />
            Gestão de Vendas & Licenças
          </h1>
          <p className="text-sm text-muted-foreground">
            Cadastre clientes, gere chaves de licença e controle a validade dos acessos.
          </p>
        </div>
        <Button onClick={() => { setEditing(null); setOpen(true); }} className="gap-2">
          <Plus className="h-4 w-4" /> Nova Licença
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total de licenças</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{stats.total}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Ativas</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold text-primary">{stats.ativas}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Receita total</CardTitle></CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              R$ {stats.receita.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Licenças cadastradas</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          {isLoading ? (
            <p className="text-muted-foreground">Carregando…</p>
          ) : licencas.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <KeyRound className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Nenhuma licença cadastrada ainda.</p>
              <p className="text-xs mt-1">Clique em "Nova Licença" para começar.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Chave</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Validade</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {licencas.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>
                      <div className="font-medium">{l.cliente_nome}</div>
                      {l.cliente_empresa && <div className="text-xs text-muted-foreground">{l.cliente_empresa}</div>}
                      {l.cliente_email && <div className="text-xs text-muted-foreground">{l.cliente_email}</div>}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-muted px-2 py-1 rounded">{l.chave_licenca}</code>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => copyKey(l.chave_licenca)}>
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="outline">{PLANOS.find(p => p.value === l.plano)?.label || l.plano}</Badge></TableCell>
                    <TableCell>
                      <Badge className={statusVariant[l.status] || ""} variant="outline">
                        {STATUS.find(s => s.value === l.status)?.label || l.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {l.data_validade ? new Date(l.data_validade).toLocaleDateString("pt-BR") : "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      R$ {Number(l.valor_pago || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {l.url_projeto && (
                          <Button size="icon" variant="ghost" className="h-8 w-8" asChild>
                            <a href={l.url_projeto} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" /></a>
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditing(l); setOpen(true); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setToDelete(l)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <LicencaDialog
        open={open}
        onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}
        editing={editing}
        onSubmit={(data) => upsert.mutate(editing ? { ...data, id: editing.id } : data)}
        loading={upsert.isPending}
      />

      <AlertDialog open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover licença?</AlertDialogTitle>
            <AlertDialogDescription>
              A licença de <strong>{toDelete?.cliente_nome}</strong> ({toDelete?.chave_licenca}) será removida permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => toDelete && remove.mutate(toDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function LicencaDialog({
  open, onOpenChange, editing, onSubmit, loading,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Licenca | null;
  onSubmit: (data: Partial<Licenca>) => void;
  loading: boolean;
}) {
  const [form, setForm] = useState<Partial<Licenca>>({});

  useEffect(() => {
    if (open) {
      setForm(editing ? { ...editing } : {
        cliente_nome: "", cliente_email: "", cliente_telefone: "", cliente_empresa: "",
        plano: "basico", status: "ativa",
        data_inicio: new Date().toISOString().slice(0, 10),
        data_validade: "", valor_pago: 0, forma_pagamento: "", url_projeto: "", observacoes: "",
      });
    }
  }, [open, editing]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[calc(100dvh-1rem)] flex flex-col overflow-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar licença" : "Nova licença"}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-auto space-y-4 pr-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <Label>Nome do cliente *</Label>
              <Input value={form.cliente_nome || ""} onChange={(e) => setForm({ ...form, cliente_nome: e.target.value })} />
            </div>
            <div>
              <Label>Empresa</Label>
              <Input value={form.cliente_empresa || ""} onChange={(e) => setForm({ ...form, cliente_empresa: e.target.value })} />
            </div>
            <div>
              <Label>E-mail</Label>
              <Input type="email" value={form.cliente_email || ""} onChange={(e) => setForm({ ...form, cliente_email: e.target.value })} />
            </div>
            <div>
              <Label>Telefone / WhatsApp</Label>
              <Input value={form.cliente_telefone || ""} onChange={(e) => setForm({ ...form, cliente_telefone: e.target.value })} />
            </div>
            <div>
              <Label>URL do projeto entregue</Label>
              <Input placeholder="https://..." value={form.url_projeto || ""} onChange={(e) => setForm({ ...form, url_projeto: e.target.value })} />
            </div>
            <div>
              <Label>Plano</Label>
              <NativeSelect
                value={form.plano || "basico"}
                onChange={(e) => setForm({ ...form, plano: e.target.value })}
                options={PLANOS}
              />
            </div>
            <div>
              <Label>Status</Label>
              <NativeSelect
                value={form.status || "ativa"}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                options={STATUS}
              />
            </div>
            <div>
              <Label>Data de início</Label>
              <Input type="date" value={form.data_inicio || ""} onChange={(e) => setForm({ ...form, data_inicio: e.target.value })} />
            </div>
            <div>
              <Label>Validade</Label>
              <Input type="date" value={form.data_validade || ""} onChange={(e) => setForm({ ...form, data_validade: e.target.value })} />
            </div>
            <div>
              <Label>Valor pago (R$)</Label>
              <Input type="number" step="0.01" value={form.valor_pago ?? 0} onChange={(e) => setForm({ ...form, valor_pago: Number(e.target.value) })} />
            </div>
            <div>
              <Label>Forma de pagamento</Label>
              <Input placeholder="PIX, Boleto, Cartão…" value={form.forma_pagamento || ""} onChange={(e) => setForm({ ...form, forma_pagamento: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <Label>Observações</Label>
              <Textarea rows={3} value={form.observacoes || ""} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
            </div>
            {editing && (
              <div className="md:col-span-2 p-3 rounded-md bg-muted">
                <Label className="text-xs">Chave da licença (não editável)</Label>
                <code className="block text-sm mt-1">{editing.chave_licenca}</code>
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={() => {
              if (!form.cliente_nome?.trim()) { toast.error("Informe o nome do cliente"); return; }
              const payload: any = { ...form };
              if (!payload.data_validade) payload.data_validade = null;
              onSubmit(payload);
            }}
            disabled={loading}
          >
            {loading ? "Salvando…" : (editing ? "Salvar alterações" : "Criar licença")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
