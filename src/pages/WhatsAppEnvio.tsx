import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserPermissions, hasModuleAccess } from "@/hooks/useUserPermissions";
import { useCoordenadores } from "@/hooks/useCoordenadores";
import { useCidadesOptions } from "@/hooks/useCidadesOptions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  MessageCircle, Send, Loader2, AlertTriangle, Paperclip, X, QrCode,
  Plus, RefreshCcw, Trash2, LogOut, Users as UsersIcon, Signal, ShieldAlert,
  CheckCircle2, XCircle, Smartphone,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";


type Instance = {
  id: string;
  user_id: string;
  instance_name: string;
  phone: string | null;
  profile_name: string | null;
  profile_picture: string | null;
  connected: boolean;
  status: string;
  qr_code: string | null;
  last_connection: string | null;
};

type Recipient = {
  id: string;
  nome: string;
  telefone: string;
  cidade_id: string | null;
  cidade_nome: string | null;
  coordenador_user_id: string | null;
};

const normalizePhone = (p?: string | null) => {
  if (!p) return "";
  let n = p.replace(/\D/g, "");
  if (n.length === 10 || n.length === 11) n = "55" + n;
  return n;
};

function StatusBadge({ inst }: { inst: Instance }) {
  if (inst.connected) {
    return (
      <Badge className="bg-emerald-600 hover:bg-emerald-700">
        <CheckCircle2 className="h-3 w-3 mr-1" /> Conectado
      </Badge>
    );
  }
  if (inst.status === "connecting" || inst.qr_code) {
    return (
      <Badge variant="outline" className="border-amber-500/50 text-amber-600">
        <QrCode className="h-3 w-3 mr-1" /> Aguardando QR
      </Badge>
    );
  }
  return (
    <Badge variant="outline">
      <XCircle className="h-3 w-3 mr-1" /> {inst.status || "desconectado"}
    </Badge>
  );
}

export default function WhatsAppEnvio() {
  const { user, userRole } = useAuth();
  const { data: permissions = [] } = useUserPermissions();
  const qc = useQueryClient();
  const hasAccess =
    userRole === "admin" ||
    userRole?.startsWith("coordenador") ||
    hasModuleAccess(userRole, permissions, "whatsapp_envio");

  const [busy, setBusy] = useState<string | null>(null);
  const [qrDialog, setQrDialog] = useState<Instance | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Instance | null>(null);
  const [selectedInstance, setSelectedInstance] = useState<string>("");

  // Instances of this user
  const { data: instances = [], isLoading: loadingInstances } = useQuery({
    queryKey: ["wa-instances", user?.id],
    enabled: hasAccess && !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_instances")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Instance[];
    },
    refetchInterval: 5000,
  });

  // Realtime updates for instances
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel("wa-instances-rt")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "whatsapp_instances" },
        () => qc.invalidateQueries({ queryKey: ["wa-instances", user.id] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, qc]);

  // Keep qrDialog synced with fresh row
  useEffect(() => {
    if (!qrDialog) return;
    const fresh = instances.find((i) => i.id === qrDialog.id);
    if (fresh && (fresh.qr_code !== qrDialog.qr_code || fresh.connected !== qrDialog.connected)) {
      setQrDialog(fresh);
      if (fresh.connected) {
        toast.success("WhatsApp conectado com sucesso!");
        setQrDialog(null);
      }
    }
  }, [instances, qrDialog]);

  const call = async (action: string, extra: any = {}) => {
    const { data, error } = await supabase.functions.invoke("whatsapp-evolution", {
      body: { action, ...extra },
    });
    if (error) throw new Error(error.message || "Erro na chamada");
    if (data?.success === false) throw new Error(data.error || "Erro");
    return data;
  };

  const handleCreate = async () => {
    setBusy("create");
    try {
      const res = await call("create");
      toast.success("Instância criada. Escaneie o QR Code.");
      setQrDialog(res.instance);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  const handleConnect = async (inst: Instance) => {
    setBusy(inst.id);
    try {
      await call("connect", { id: inst.id });
      setQrDialog(inst);
      toast.info("QR atualizado — escaneie no WhatsApp.");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  const handleStatus = async (inst: Instance) => {
    setBusy(inst.id);
    try {
      const res = await call("status", { id: inst.id });
      toast.success(`Status: ${res.state}`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  const handleLogout = async (inst: Instance) => {
    setBusy(inst.id);
    try {
      await call("logout", { id: inst.id });
      toast.success("Sessão encerrada.");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setBusy(deleteTarget.id);
    try {
      await call("delete", { id: deleteTarget.id });
      toast.success("Conexão removida.");
      setDeleteTarget(null);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  const connectedInstances = instances.filter((i) => i.connected);
  useEffect(() => {
    if (!selectedInstance && connectedInstances[0]) {
      setSelectedInstance(connectedInstances[0].id);
    }
  }, [connectedInstances, selectedInstance]);

  // -------- Envio --------
  const { data: cidades = [] } = useCidadesOptions();
  const { data: coordenadores = [] } = useCoordenadores();
  const [filterCoord, setFilterCoord] = useState("");
  const [filterCidade, setFilterCidade] = useState("");
  const [filterLideranca, setFilterLideranca] = useState("");
  const [search, setSearch] = useState("");

  const { data: liderancas = [] } = useQuery({
    queryKey: ["wa-liderancas"],
    enabled: hasAccess,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("liderancas")
        .select("id, nome, telefone, whatsapp, cidade_base_id, coordenador_user_id, cidades:cidade_base_id(nome)")
        .order("nome");
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const recipients: Recipient[] = useMemo(() => {
    return (liderancas || [])
      .map((l: any) => ({
        id: l.id,
        nome: l.nome,
        telefone: normalizePhone(l.whatsapp || l.telefone),
        cidade_nome: l.cidades?.nome || null,
        cidade_id: l.cidade_base_id,
        coordenador_user_id: l.coordenador_user_id,
      }))
      .filter((r: any) => r.telefone && r.telefone.length >= 12);
  }, [liderancas]);

  const filtered = useMemo(() => {
    return recipients.filter((r: any) => {
      if (filterCoord && r.coordenador_user_id !== filterCoord) return false;
      if (filterCidade && r.cidade_id !== filterCidade) return false;
      if (filterLideranca && r.id !== filterLideranca) return false;
      if (search && !r.nome.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [recipients, filterCoord, filterCidade, filterLideranca, search]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const allSelected = filtered.length > 0 && filtered.every((r) => selectedIds.has(r.id));
  const toggleAll = () => {
    const next = new Set(selectedIds);
    if (allSelected) filtered.forEach((r) => next.delete(r.id));
    else filtered.forEach((r) => next.add(r.id));
    setSelectedIds(next);
  };
  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedIds(next);
  };

  const [message, setMessage] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState<{ ok: number; fail: number } | null>(null);

  const handleAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    if (f && f.size > 25 * 1024 * 1024) {
      toast.error("Arquivo acima de 25MB. Reduza o tamanho.");
      return;
    }
    setAttachment(f);
  };

  const uploadAttachment = async (file: File) => {
    const path = `whatsapp/${Date.now()}-${file.name.replace(/\s+/g, "_")}`;
    const { error } = await supabase.storage.from("app-assets").upload(path, file, { upsert: true });
    if (error) throw error;
    const { data } = supabase.storage.from("app-assets").getPublicUrl(path);
    return data.publicUrl;
  };

  const getMediaType = (f: File): "image" | "video" | "document" => {
    if (f.type.startsWith("image/")) return "image";
    if (f.type.startsWith("video/")) return "video";
    return "document";
  };

  const handleSend = async () => {
    if (!selectedInstance) {
      toast.error("Selecione uma conexão do WhatsApp conectada.");
      return;
    }
    if (!message.trim() && !attachment) {
      toast.error("Escreva uma mensagem ou anexe um arquivo.");
      return;
    }
    const targets = filtered.filter((r) => selectedIds.has(r.id));
    if (targets.length === 0) {
      toast.error("Selecione ao menos um destinatário.");
      return;
    }
    if (!window.confirm(`Enviar mensagem para ${targets.length} destinatário(s)?`)) return;

    setSending(true);
    setProgress({ ok: 0, fail: 0 });

    let mediaUrl: string | null = null;
    let mediaType: "image" | "video" | "document" | null = null;
    try {
      if (attachment) {
        mediaUrl = await uploadAttachment(attachment);
        mediaType = getMediaType(attachment);
      }
    } catch (e: any) {
      toast.error("Falha ao subir anexo: " + e.message);
      setSending(false);
      return;
    }

    let ok = 0;
    let fail = 0;
    for (const r of targets) {
      try {
        if (mediaUrl && mediaType) {
          await call("send-media", {
            id: selectedInstance,
            to: r.telefone,
            mediaUrl,
            mediaType,
            caption: message.trim() || undefined,
            fileName: attachment?.name,
          });
        } else {
          await call("send-text", {
            id: selectedInstance,
            to: r.telefone,
            text: message.trim(),
          });
        }
        ok++;
      } catch (e: any) {
        fail++;
        console.warn(`Falha p/ ${r.nome}:`, e.message);
      }
      setProgress({ ok, fail });
      await new Promise((res) => setTimeout(res, 800));
    }

    setSending(false);
    toast.success(`Envio concluído: ${ok} enviado(s), ${fail} falha(s).`);
    if (fail === 0) {
      setMessage("");
      setAttachment(null);
      setSelectedIds(new Set());
    }
  };

  if (!hasAccess) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Acesso restrito</AlertTitle>
          <AlertDescription>
            O módulo WhatsApp está disponível apenas para administradores e coordenadores.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageCircle className="h-6 w-6 text-primary" /> WhatsApp
          </h1>
          <p className="text-sm text-muted-foreground">
            Conecte seu próprio WhatsApp via QR Code (Evolution API) e envie mensagens à sua base.
          </p>
        </div>
        <Badge variant={connectedInstances.length ? "default" : "outline"}>
          <Signal className="h-3 w-3 mr-1" />
          {connectedInstances.length} conexão(ões) ativa(s)
        </Badge>
      </div>

      <Tabs defaultValue="conexoes" className="space-y-4">
        <TabsList>
          <TabsTrigger value="conexoes">
            <Smartphone className="h-4 w-4 mr-1" /> Minhas Conexões
          </TabsTrigger>
          <TabsTrigger value="envio">
            <Send className="h-4 w-4 mr-1" /> Envio
          </TabsTrigger>
        </TabsList>

        {/* ===== Conexões ===== */}
        <TabsContent value="conexoes" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={handleCreate} disabled={busy === "create"}>
              {busy === "create" ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-1" />
              )}
              Conectar WhatsApp
            </Button>
          </div>

          {loadingInstances ? (
            <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
              <Loader2 className="inline h-5 w-5 mr-2 animate-spin" /> Carregando...
            </CardContent></Card>
          ) : instances.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
              Nenhum WhatsApp conectado ainda. Clique em <strong>Conectar WhatsApp</strong>.
            </CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {instances.map((inst) => (
                <Card key={inst.id} className={inst.connected ? "border-emerald-500/40" : ""}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={inst.profile_picture || undefined} />
                        <AvatarFallback>
                          <Smartphone className="h-5 w-5" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base truncate">
                          {inst.profile_name || inst.instance_name}
                        </CardTitle>
                        <CardDescription className="truncate text-xs">
                          {inst.phone ? `+${inst.phone}` : "Aguardando conexão"}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="pt-2"><StatusBadge inst={inst} /></div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {inst.last_connection && (
                      <p className="text-xs text-muted-foreground">
                        Últ. conexão: {new Date(inst.last_connection).toLocaleString("pt-BR")}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1 pt-2">
                      {!inst.connected && (
                        <Button size="sm" variant="outline" onClick={() => handleConnect(inst)}
                          disabled={busy === inst.id}>
                          <QrCode className="h-3.5 w-3.5 mr-1" /> QR
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => handleStatus(inst)}
                        disabled={busy === inst.id}>
                        <RefreshCcw className="h-3.5 w-3.5 mr-1" /> Status
                      </Button>
                      {inst.connected && (
                        <Button size="sm" variant="outline" onClick={() => handleLogout(inst)}
                          disabled={busy === inst.id}>
                          <LogOut className="h-3.5 w-3.5 mr-1" /> Sair
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="text-destructive"
                        onClick={() => setDeleteTarget(inst)} disabled={busy === inst.id}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ===== Envio ===== */}
        <TabsContent value="envio" className="space-y-4">
          {connectedInstances.length === 0 ? (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Nenhum WhatsApp conectado</AlertTitle>
              <AlertDescription>
                Vá à aba <strong>Minhas Conexões</strong> e escaneie o QR para conectar.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-2">
              <Label>Enviar a partir de</Label>
              <select
                className="h-10 w-full max-w-md rounded-md border border-input bg-background px-3 text-sm"
                value={selectedInstance}
                onChange={(e) => setSelectedInstance(e.target.value)}
              >
                {connectedInstances.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.profile_name || i.instance_name} {i.phone ? `(+${i.phone})` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <UsersIcon className="h-5 w-5" /> Destinatários
                </CardTitle>
                <CardDescription>
                  Filtre por coordenador, cidade ou liderança individual.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Coordenador</Label>
                    <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={filterCoord} onChange={(e) => setFilterCoord(e.target.value)}>
                      <option value="">Todos</option>
                      {coordenadores.map((c) => (
                        <option key={c.user_id} value={c.user_id}>{c.nome}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Cidade</Label>
                    <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={filterCidade} onChange={(e) => setFilterCidade(e.target.value)}>
                      <option value="">Todas</option>
                      {cidades.map((c) => (
                        <option key={c.id} value={c.id}>{c.nome}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Liderança (individual)</Label>
                    <select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={filterLideranca} onChange={(e) => setFilterLideranca(e.target.value)}>
                      <option value="">Todas</option>
                      {recipients.map((r) => (
                        <option key={r.id} value={r.id}>{r.nome}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <Input placeholder="Buscar por nome..."
                  value={search} onChange={(e) => setSearch(e.target.value)} />

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{filtered.length} contato(s) • {selectedIds.size} selecionado(s)</span>
                  <Button variant="ghost" size="sm" onClick={toggleAll}>
                    {allSelected ? "Limpar seleção" : "Selecionar todos"}
                  </Button>
                </div>

                <ScrollArea className="h-[360px] rounded border">
                  <div className="divide-y">
                    {filtered.length === 0 && (
                      <p className="p-6 text-center text-sm text-muted-foreground">
                        Nenhuma liderança com WhatsApp/telefone válido para os filtros.
                      </p>
                    )}
                    {filtered.map((r) => (
                      <label key={r.id}
                        className="flex items-center gap-3 px-3 py-2 hover:bg-accent/40 cursor-pointer">
                        <Checkbox checked={selectedIds.has(r.id)} onCheckedChange={() => toggleOne(r.id)} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{r.nome}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {r.telefone}{r.cidade_nome ? ` • ${r.cidade_nome}` : ""}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Send className="h-5 w-5" /> Mensagem
                </CardTitle>
                <CardDescription>
                  Texto livre + anexo opcional (imagem, vídeo ou documento até 25MB).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea rows={8}
                  placeholder="Digite a mensagem que será enviada..."
                  value={message} onChange={(e) => setMessage(e.target.value)} />

                <div className="space-y-2">
                  <Label className="text-xs">Anexo (opcional)</Label>
                  {attachment ? (
                    <div className="flex items-center gap-2 rounded border bg-muted/30 px-3 py-2 text-sm">
                      <Paperclip className="h-4 w-4 text-muted-foreground" />
                      <span className="flex-1 truncate">{attachment.name}</span>
                      <Button variant="ghost" size="icon" className="h-7 w-7"
                        onClick={() => setAttachment(null)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <Input type="file"
                      accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
                      onChange={handleAttach} />
                  )}
                </div>

                {progress && (
                  <Alert>
                    <AlertDescription className="text-xs">
                      Enviadas: <strong>{progress.ok}</strong> • Falhas: <strong>{progress.fail}</strong>
                    </AlertDescription>
                  </Alert>
                )}

                <Button className="w-full"
                  disabled={sending || connectedInstances.length === 0 || !selectedInstance}
                  onClick={handleSend}>
                  {sending ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enviando...</>
                  ) : (
                    <><Send className="h-4 w-4 mr-2" /> Enviar para {selectedIds.size || 0} contato(s)</>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* QR Dialog */}
      <Dialog open={!!qrDialog} onOpenChange={(v) => !v && setQrDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" /> Escaneie o QR Code
            </DialogTitle>
            <DialogDescription>
              Abra o WhatsApp → <strong>Dispositivos conectados</strong> → <strong>Conectar dispositivo</strong>.
              O QR expira em ~60s — clique em "Atualizar QR" se precisar de um novo.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3 py-2">
            {qrDialog?.qr_code ? (
              <img
                src={qrDialog.qr_code.startsWith("data:") ? qrDialog.qr_code : `data:image/png;base64,${qrDialog.qr_code}`}
                alt="QR Code"
                className="w-64 h-64 rounded border bg-white p-2"
              />
            ) : (
              <div className="w-64 h-64 flex items-center justify-center border rounded bg-muted/30">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}
            <div className="flex gap-2">
              {qrDialog && (
                <Button variant="outline" size="sm" onClick={() => handleConnect(qrDialog)}
                  disabled={busy === qrDialog.id}>
                  <RefreshCcw className="h-3.5 w-3.5 mr-1" /> Atualizar QR
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover conexão</AlertDialogTitle>
            <AlertDialogDescription>
              Isso encerra a sessão no aparelho e apaga esta instância. Você poderá reconectar depois.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
