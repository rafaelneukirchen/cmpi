import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { PageHeader } from "@/components/logistics/PageHeader";
import { LogStatCard } from "@/components/logistics/LogStatCard";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { logAudit } from "@/lib/auditLog";
import { exportTablePdf, exportTableExcel } from "@/lib/exportPdf";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DollarSign, TrendingUp, TrendingDown, Plus, Pencil, Trash2, ArrowUpCircle, ArrowDownCircle, ReceiptText, CalendarClock, Download } from "lucide-react";

const money = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (d: string) => {
  try { return format(new Date(d + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR }); } catch { return d; }
};

const statusColor: Record<string, string> = {
  Pendente: "bg-amber-500/15 text-amber-600 border-amber-500/30",
  Aprovado: "bg-primary/15 text-primary border-primary/30",
  Rejeitado: "bg-destructive/15 text-destructive border-destructive/30",
  Pago: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30",
  Atrasado: "bg-destructive/15 text-destructive border-destructive/30",
  Cancelado: "bg-muted text-muted-foreground border-border",
};

async function getCurrentUserInfo() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user_id: null as string | null, nome: null as string | null };
  const { data: profile } = await supabase.from("profiles").select("nome").eq("user_id", user.id).maybeSingle();
  return { user_id: user.id, nome: profile?.nome || user.email || null };
}

export default function LogFinanceiro() {
  const { userRole } = useAuth();
  const isMobile = useIsMobile();
  const qc = useQueryClient();
  const isAdmin = userRole === "admin";

  const { data: transactions = [] } = useQuery({
    queryKey: ["financial_transactions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("financial_transactions" as any).select("*").order("date", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: reimbursements = [] } = useQuery({
    queryKey: ["reimbursements"],
    queryFn: async () => {
      const { data, error } = await supabase.from("reimbursements" as any).select("*").order("date", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["payment_schedule"],
    queryFn: async () => {
      const { data, error } = await supabase.from("payment_schedule" as any).select("*").order("due_date", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: deletedLogs = [] } = useQuery({
    queryKey: ["financial_deleted_logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_log" as any)
        .select("*")
        .eq("action", "DELETE")
        .in("table_name", ["financial_transactions", "reimbursements", "payment_schedule"])
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as any[];
    },
  });

  const totalEntradas = transactions.filter((t: any) => t.type === "Entrada").reduce((s: number, t: any) => s + Number(t.amount), 0);
  const totalSaidas = transactions.filter((t: any) => t.type === "Saída").reduce((s: number, t: any) => s + Number(t.amount), 0);
  const saldo = totalEntradas - totalSaidas;
  const reembolsosPendentes = reimbursements.filter((r: any) => r.status === "Pendente").reduce((s: number, r: any) => s + Number(r.amount), 0);

  const [txOpen, setTxOpen] = useState(false);
  const [txEdit, setTxEdit] = useState<any>(null);
  const [txForm, setTxForm] = useState({ type: "Entrada", description: "", amount: "", category: "", payment_method: "", date: new Date().toISOString().slice(0, 10), notes: "" });

  const openNewTx = () => { setTxEdit(null); setTxForm({ type: "Entrada", description: "", amount: "", category: "", payment_method: "", date: new Date().toISOString().slice(0, 10), notes: "" }); setTxOpen(true); };
  const openEditTx = (t: any) => { setTxEdit(t); setTxForm({ type: t.type, description: t.description, amount: String(t.amount), category: t.category || "", payment_method: t.payment_method || "", date: t.date, notes: t.notes || "" }); setTxOpen(true); };

  const txMutation = useMutation({
    mutationFn: async () => {
      const author = await getCurrentUserInfo();
      const payload: any = { type: txForm.type, description: txForm.description, amount: Number(txForm.amount), category: txForm.category || null, date: txForm.date, notes: txForm.notes || null, payment_method: txForm.payment_method || null };
      if (txEdit) {
        const { error } = await supabase.from("financial_transactions" as any).update(payload).eq("id", txEdit.id);
        if (error) throw error;
        await logAudit("UPDATE", "financial_transactions", txEdit.id, payload);
      } else {
        const { error } = await supabase.from("financial_transactions" as any).insert({ ...payload, criado_por_user_id: author.user_id, criado_por_nome: author.nome });
        if (error) throw error;
        await logAudit("INSERT", "financial_transactions", undefined, payload);
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["financial_transactions"] }); setTxOpen(false); toast.success(txEdit ? "Transação atualizada" : "Transação registrada"); },
    onError: (e: any) => toast.error(e.message),
  });

  const [rbOpen, setRbOpen] = useState(false);
  const [rbEdit, setRbEdit] = useState<any>(null);
  const [rbForm, setRbForm] = useState({ description: "", amount: "", status: "Pendente", payment_method: "", date: new Date().toISOString().slice(0, 10), notes: "" });

  const openNewRb = () => { setRbEdit(null); setRbForm({ description: "", amount: "", status: "Pendente", payment_method: "", date: new Date().toISOString().slice(0, 10), notes: "" }); setRbOpen(true); };
  const openEditRb = (r: any) => { setRbEdit(r); setRbForm({ description: r.description, amount: String(r.amount), status: r.status, payment_method: r.payment_method || "", date: r.date, notes: r.notes || "" }); setRbOpen(true); };

  const rbMutation = useMutation({
    mutationFn: async () => {
      const author = await getCurrentUserInfo();
      const payload: any = { description: rbForm.description, amount: Number(rbForm.amount), status: rbForm.status, payment_method: rbForm.payment_method || null, date: rbForm.date, notes: rbForm.notes || null };
      if (rbEdit) {
        const { error } = await supabase.from("reimbursements" as any).update(payload).eq("id", rbEdit.id);
        if (error) throw error;
        await logAudit("UPDATE", "reimbursements", rbEdit.id, payload);
      } else {
        const { error } = await supabase.from("reimbursements" as any).insert({ ...payload, criado_por_user_id: author.user_id, criado_por_nome: author.nome });
        if (error) throw error;
        await logAudit("INSERT", "reimbursements", undefined, payload);
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["reimbursements"] }); setRbOpen(false); toast.success(rbEdit ? "Reembolso atualizado" : "Reembolso registrado"); },
    onError: (e: any) => toast.error(e.message),
  });

  const [pmOpen, setPmOpen] = useState(false);
  const [pmEdit, setPmEdit] = useState<any>(null);
  const [pmForm, setPmForm] = useState({ description: "", payee: "", amount: "", due_date: new Date().toISOString().slice(0, 10), status: "Pendente", category: "", payment_method: "", notes: "" });

  const openNewPm = () => { setPmEdit(null); setPmForm({ description: "", payee: "", amount: "", due_date: new Date().toISOString().slice(0, 10), status: "Pendente", category: "", payment_method: "", notes: "" }); setPmOpen(true); };
  const openEditPm = (p: any) => { setPmEdit(p); setPmForm({ description: p.description, payee: p.payee, amount: String(p.amount), due_date: p.due_date, status: p.status, category: p.category || "", payment_method: p.payment_method || "", notes: p.notes || "" }); setPmOpen(true); };

  const pmMutation = useMutation({
    mutationFn: async () => {
      const author = await getCurrentUserInfo();
      const payload: any = { description: pmForm.description, payee: pmForm.payee, amount: Number(pmForm.amount), due_date: pmForm.due_date, status: pmForm.status, category: pmForm.category || null, payment_method: pmForm.payment_method || null, notes: pmForm.notes || null };
      if (pmEdit) {
        const { error } = await supabase.from("payment_schedule" as any).update(payload).eq("id", pmEdit.id);
        if (error) throw error;
        await logAudit("UPDATE", "payment_schedule", pmEdit.id, payload);
      } else {
        const { error } = await supabase.from("payment_schedule" as any).insert({ ...payload, criado_por_user_id: author.user_id, criado_por_nome: author.nome });
        if (error) throw error;
        await logAudit("INSERT", "payment_schedule", undefined, payload);
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["payment_schedule"] }); setPmOpen(false); toast.success(pmEdit ? "Pagamento atualizado" : "Pagamento agendado"); },
    onError: (e: any) => toast.error(e.message),
  });

  const [delTarget, setDelTarget] = useState<{ table: string; id: string; label: string } | null>(null);
  const deleteMutation = useMutation({
    mutationFn: async (target: { table: string; id: string; label: string }) => {
      const author = await getCurrentUserInfo();
      const { error } = await supabase.from(target.table as any).delete().eq("id", target.id);
      if (error) throw error;
      await logAudit("DELETE", target.table, target.id, { label: target.label, excluido_por: author.nome });
      return target;
    },
    onSuccess: (target) => {
      qc.invalidateQueries({ queryKey: [target.table] });
      qc.invalidateQueries({ queryKey: ["financial_deleted_logs"] });
      toast.success("Registro excluído");
      setDelTarget(null);
    },
    onError: (e: any) => {
      toast.error(e.message || "Erro ao excluir. Verifique se você tem acesso ao módulo financeiro.");
      setDelTarget(null);
    },
  });

  const handleExportPdf = () => {
    exportTablePdf("Financeiro - Caixa", ["Tipo", "Descrição", "Categoria", "Forma Pagto", "Data", "Valor"],
      transactions.map((t: any) => [t.type, t.description, t.category || "-", t.payment_method || "-", t.date, String(t.amount)])
    );
  };
  const handleExportExcel = () => {
    exportTableExcel("Financeiro - Caixa", ["Tipo", "Descrição", "Categoria", "Forma Pagto", "Data", "Valor"],
      transactions.map((t: any) => [t.type, t.description, t.category || "-", t.payment_method || "-", t.date, String(t.amount)])
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Controle Financeiro" description="Gestão de caixa, reembolsos e pagamentos">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={handleExportPdf}><Download className="w-4 h-4" /> PDF</Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={handleExportExcel}><Download className="w-4 h-4" /> Excel</Button>
        </div>
      </PageHeader>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <LogStatCard title="Saldo" value={money(saldo)} icon={DollarSign} />
        <LogStatCard title="Entradas" value={money(totalEntradas)} icon={TrendingUp} />
        <LogStatCard title="Saídas" value={money(totalSaidas)} icon={TrendingDown} />
        <LogStatCard title="Reembolsos Pend." value={money(reembolsosPendentes)} icon={ReceiptText} />
      </div>

      <Tabs defaultValue="caixa" className="space-y-4">
        <TabsList className={isMobile ? "w-full grid grid-cols-4" : ""}>
          <TabsTrigger value="caixa" className="gap-1.5"><DollarSign className="w-3.5 h-3.5" />{!isMobile && "Caixa"}</TabsTrigger>
          <TabsTrigger value="reembolsos" className="gap-1.5"><ReceiptText className="w-3.5 h-3.5" />{!isMobile && "Reembolsos"}</TabsTrigger>
          <TabsTrigger value="pagamentos" className="gap-1.5"><CalendarClock className="w-3.5 h-3.5" />{!isMobile && "Pagamentos"}</TabsTrigger>
          <TabsTrigger value="excluidos" className="gap-1.5"><Trash2 className="w-3.5 h-3.5" />{!isMobile && "Excluídos"}</TabsTrigger>
        </TabsList>

        <TabsContent value="caixa">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">Movimentações de Caixa</CardTitle>
              <Button size="sm" onClick={openNewTx}><Plus className="w-4 h-4 mr-1" />Novo</Button>
            </CardHeader>
            <CardContent className="p-0 md:p-6">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Tipo</TableHead><TableHead>Descrição</TableHead><TableHead>Categoria</TableHead><TableHead>Forma Pagto</TableHead><TableHead>Data</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Registrado por</TableHead><TableHead></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {transactions.map((t: any) => (
                    <TableRow key={t.id}>
                      <TableCell>
                        <Badge variant="outline" className={t.type === "Entrada" ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" : "bg-destructive/15 text-destructive border-destructive/30"}>
                          {t.type === "Entrada" ? <ArrowUpCircle className="w-3 h-3 mr-1" /> : <ArrowDownCircle className="w-3 h-3 mr-1" />}{t.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{t.description}</TableCell>
                      <TableCell>{t.category || "—"}</TableCell>
                      <TableCell>{t.payment_method || "—"}</TableCell>
                      <TableCell>{fmtDate(t.date)}</TableCell>
                      <TableCell className={`text-right font-semibold ${t.type === "Entrada" ? "text-emerald-600" : "text-destructive"}`}>{money(Number(t.amount))}</TableCell>
                      <TableCell>
                        {t.criado_por_nome ? (
                          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 font-medium">
                            Operador {t.criado_por_nome}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditTx(t)}><Pencil className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDelTarget({ table: "financial_transactions", id: t.id, label: t.description })}><Trash2 className="w-4 h-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {transactions.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Nenhuma transação registrada</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reembolsos">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">Reembolsos</CardTitle>
              <Button size="sm" onClick={openNewRb}><Plus className="w-4 h-4 mr-1" />Novo</Button>
            </CardHeader>
            <CardContent className="p-0 md:p-6">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Descrição</TableHead><TableHead>Data</TableHead><TableHead>Forma</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Registrado por</TableHead><TableHead></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {reimbursements.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.description}</TableCell>
                      <TableCell>{fmtDate(r.date)}</TableCell>
                      <TableCell>{r.payment_method || "—"}</TableCell>
                      <TableCell><Badge variant="outline" className={statusColor[r.status] || ""}>{r.status}</Badge></TableCell>
                      <TableCell className="text-right font-semibold">{money(Number(r.amount))}</TableCell>
                      <TableCell>
                        {r.criado_por_nome ? (
                          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 font-medium">
                            Operador {r.criado_por_nome}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditRb(r)}><Pencil className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDelTarget({ table: "reimbursements", id: r.id, label: r.description })}><Trash2 className="w-4 h-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {reimbursements.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Nenhum reembolso registrado</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pagamentos">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">Programação de Pagamentos</CardTitle>
              <Button size="sm" onClick={openNewPm}><Plus className="w-4 h-4 mr-1" />Novo</Button>
            </CardHeader>
            <CardContent className="p-0 md:p-6">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Descrição</TableHead><TableHead>Beneficiário</TableHead><TableHead>Vencimento</TableHead><TableHead>Forma</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Registrado por</TableHead><TableHead></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {payments.map((p: any) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.description}</TableCell>
                      <TableCell>{p.payee}</TableCell>
                      <TableCell>{fmtDate(p.due_date)}</TableCell>
                      <TableCell>{p.payment_method || "—"}</TableCell>
                      <TableCell><Badge variant="outline" className={statusColor[p.status] || ""}>{p.status}</Badge></TableCell>
                      <TableCell className="text-right font-semibold">{money(Number(p.amount))}</TableCell>
                      <TableCell>
                        {p.criado_por_nome ? (
                          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 font-medium">
                            Operador {p.criado_por_nome}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditPm(p)}><Pencil className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDelTarget({ table: "payment_schedule", id: p.id, label: p.description })}><Trash2 className="w-4 h-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {payments.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Nenhum pagamento agendado</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="excluidos">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2 text-destructive">
                <Trash2 className="w-4 h-4" /> Histórico de Exclusões
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Registros financeiros excluídos. Visível para todos com acesso ao módulo financeiro.
              </p>
            </CardHeader>
            <CardContent className="p-0 md:p-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Excluído por</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deletedLogs.map((log: any) => {
                    const tableLabel: Record<string, string> = {
                      financial_transactions: "Caixa",
                      reimbursements: "Reembolso",
                      payment_schedule: "Pagamento",
                    };
                    const detalhes = (log.details ?? {}) as any;
                    const label = detalhes.label || log.record_id || "—";
                    const quem = detalhes.excluido_por || log.executor_name || "—";
                    return (
                      <TableRow key={log.id} className="bg-destructive/5 hover:bg-destructive/10">
                        <TableCell className="text-destructive font-medium text-xs whitespace-nowrap">
                          {format(new Date(log.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-destructive/15 text-destructive border-destructive/30">
                            {tableLabel[log.table_name] || log.table_name}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium text-destructive line-through">{label}</TableCell>
                        <TableCell>
                          {quem !== "—" ? (
                            <Badge variant="outline" className="bg-destructive/15 text-destructive border-destructive/30 font-medium">
                              Operador {quem}
                            </Badge>
                          ) : (
                            <span className="text-xs text-destructive/80">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {deletedLogs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        Nenhuma exclusão registrada
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Transaction Dialog */}
      <Dialog open={txOpen} onOpenChange={setTxOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{txEdit ? "Editar Transação" : "Nova Transação"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Tipo</Label><NativeSelect value={txForm.type} onChange={e => setTxForm(f => ({ ...f, type: e.target.value }))} options={[{value:"Entrada",label:"Entrada"},{value:"Saída",label:"Saída"}]} /></div>
            <div><Label>Descrição</Label><Input value={txForm.description} onChange={e => setTxForm(f => ({ ...f, description: e.target.value }))} /></div>
            <div><Label>Valor (R$)</Label><Input type="number" step="0.01" value={txForm.amount} onChange={e => setTxForm(f => ({ ...f, amount: e.target.value }))} /></div>
            <div><Label>Categoria</Label><Input value={txForm.category} onChange={e => setTxForm(f => ({ ...f, category: e.target.value }))} /></div>
            <div>
              <Label>Forma de {txForm.type === "Entrada" ? "Recebimento" : "Pagamento"}</Label>
              <NativeSelect
                value={txForm.payment_method}
                onChange={e => setTxForm(f => ({ ...f, payment_method: e.target.value }))}
                placeholder="Selecione..."
                options={[
                  { value: "Dinheiro", label: "Dinheiro" },
                  { value: "PIX", label: "PIX" },
                  { value: "Cartão de Débito", label: "Cartão de Débito" },
                  { value: "Cartão de Crédito", label: "Cartão de Crédito" },
                  { value: "Transferência", label: "Transferência Bancária" },
                  { value: "Boleto", label: "Boleto" },
                  { value: "Cheque", label: "Cheque" },
                  { value: "Outro", label: "Outro" },
                ]}
              />
            </div>
            <div><Label>Data</Label><Input type="date" value={txForm.date} onChange={e => setTxForm(f => ({ ...f, date: e.target.value }))} /></div>
            <div><Label>Observações</Label><Textarea value={txForm.notes} onChange={e => setTxForm(f => ({ ...f, notes: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTxOpen(false)}>Cancelar</Button>
            <Button onClick={() => txMutation.mutate()} disabled={!txForm.description || !txForm.amount || txMutation.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reimbursement Dialog */}
      <Dialog open={rbOpen} onOpenChange={setRbOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{rbEdit ? "Editar Reembolso" : "Novo Reembolso"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Descrição</Label><Input value={rbForm.description} onChange={e => setRbForm(f => ({ ...f, description: e.target.value }))} /></div>
            <div><Label>Valor (R$)</Label><Input type="number" step="0.01" value={rbForm.amount} onChange={e => setRbForm(f => ({ ...f, amount: e.target.value }))} /></div>
            <div><Label>Status</Label><NativeSelect value={rbForm.status} onChange={e => setRbForm(f => ({ ...f, status: e.target.value }))} options={[{value:"Pendente",label:"Pendente"},{value:"Aprovado",label:"Aprovado"},{value:"Rejeitado",label:"Rejeitado"},{value:"Pago",label:"Pago"}]} /></div>
            <div>
              <Label>Forma de Pagamento</Label>
              <NativeSelect
                value={rbForm.payment_method}
                onChange={e => setRbForm(f => ({ ...f, payment_method: e.target.value }))}
                placeholder="Selecione..."
                options={[
                  { value: "Dinheiro", label: "Dinheiro" },
                  { value: "PIX", label: "PIX" },
                  { value: "Cartão de Débito", label: "Cartão de Débito" },
                  { value: "Cartão de Crédito", label: "Cartão de Crédito" },
                  { value: "Transferência", label: "Transferência Bancária" },
                  { value: "Boleto", label: "Boleto" },
                  { value: "Cheque", label: "Cheque" },
                  { value: "Outro", label: "Outro" },
                ]}
              />
            </div>
            <div><Label>Data</Label><Input type="date" value={rbForm.date} onChange={e => setRbForm(f => ({ ...f, date: e.target.value }))} /></div>
            <div><Label>Observações</Label><Textarea value={rbForm.notes} onChange={e => setRbForm(f => ({ ...f, notes: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRbOpen(false)}>Cancelar</Button>
            <Button onClick={() => rbMutation.mutate()} disabled={!rbForm.description || !rbForm.amount || rbMutation.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={pmOpen} onOpenChange={setPmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{pmEdit ? "Editar Pagamento" : "Novo Pagamento"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Descrição</Label><Input value={pmForm.description} onChange={e => setPmForm(f => ({ ...f, description: e.target.value }))} /></div>
            <div><Label>Beneficiário</Label><Input value={pmForm.payee} onChange={e => setPmForm(f => ({ ...f, payee: e.target.value }))} /></div>
            <div><Label>Valor (R$)</Label><Input type="number" step="0.01" value={pmForm.amount} onChange={e => setPmForm(f => ({ ...f, amount: e.target.value }))} /></div>
            <div><Label>Vencimento</Label><Input type="date" value={pmForm.due_date} onChange={e => setPmForm(f => ({ ...f, due_date: e.target.value }))} /></div>
            <div><Label>Status</Label><NativeSelect value={pmForm.status} onChange={e => setPmForm(f => ({ ...f, status: e.target.value }))} options={[{value:"Pendente",label:"Pendente"},{value:"Pago",label:"Pago"},{value:"Atrasado",label:"Atrasado"},{value:"Cancelado",label:"Cancelado"}]} /></div>
            <div>
              <Label>Forma de Pagamento</Label>
              <NativeSelect
                value={pmForm.payment_method}
                onChange={e => setPmForm(f => ({ ...f, payment_method: e.target.value }))}
                placeholder="Selecione..."
                options={[
                  { value: "Dinheiro", label: "Dinheiro" },
                  { value: "PIX", label: "PIX" },
                  { value: "Cartão de Débito", label: "Cartão de Débito" },
                  { value: "Cartão de Crédito", label: "Cartão de Crédito" },
                  { value: "Transferência", label: "Transferência Bancária" },
                  { value: "Boleto", label: "Boleto" },
                  { value: "Cheque", label: "Cheque" },
                  { value: "Outro", label: "Outro" },
                ]}
              />
            </div>
            <div><Label>Observações</Label><Textarea value={pmForm.notes} onChange={e => setPmForm(f => ({ ...f, notes: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPmOpen(false)}>Cancelar</Button>
            <Button onClick={() => pmMutation.mutate()} disabled={!pmForm.description || !pmForm.payee || !pmForm.amount || pmMutation.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={!!delTarget} onOpenChange={o => !o && !deleteMutation.isPending && setDelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Registro</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>"{delTarget?.label}"</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); if (delTarget) deleteMutation.mutate(delTarget); }}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
