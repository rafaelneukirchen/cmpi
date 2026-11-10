import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { UserCog, Plus, Trash2, Loader2, Shield, MapPin, X, Pencil, Search, Lock, Palette, Link2, Mail, Send, KeyRound, LifeBuoy, Check } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useCidades } from "@/hooks/useSupabaseData";
import { ALL_MODULES } from "@/hooks/useUserPermissions";
import { CaptacaoLinkPanel } from "@/components/CaptacaoLinkPanel";
import { useEleitoresCaptadosCountByUsuario } from "@/hooks/useEleitoresCaptados";
import { SearchSelect } from "@/components/ui/search-select";

const roleLabels: Record<string, string> = {
  admin: "Administrador",
  coordenador_estadual: "Coord. Estadual",
  coordenador_regional: "Coord. Regional",
  operador_cadastro: "Operador",
  analista_eleitoral: "Analista",
};

const roleBadgeVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  admin: "destructive",
  coordenador_estadual: "default",
  coordenador_regional: "default",
  operador_cadastro: "secondary",
  analista_eleitoral: "outline",
};

interface UserData {
  id: string;
  user_id: string;
  nome: string;
  email: string;
  role: string | null;
  cidades_ids: string[];
  permissions: string[];
  cor: string | null;
  token_publico: string | null;
}

function useUsers() {
  return useQuery({
    queryKey: ["users-management"],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.functions.invoke("manage-users", {
          body: { action: "list" },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        return (data?.users || []) as UserData[];
      } catch (e: any) {
        console.error("useUsers error:", e);
        throw e;
      }
    },
    retry: 1,
  });
}

function CidadesMultiSelect({ value, onChange, cidades }: {
  value: string[];
  onChange: (val: string[]) => void;
  cidades: { id: string; nome: string }[];
}) {
  const [search, setSearch] = useState("");
  const cidadeMap = useMemo(() => new Map(cidades.map(c => [c.id, c])), [cidades]);

  const filtered = useMemo(() => {
    if (!search) return cidades;
    const s = search.toLowerCase();
    return cidades.filter(c => c.nome.toLowerCase().includes(s));
  }, [cidades, search]);

  const toggle = (id: string) => {
    onChange(value.includes(id) ? value.filter(v => v !== id) : [...value, id]);
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar cidade..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
      </div>
      <div className="h-[180px] overflow-y-auto rounded-md border p-2">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhuma cidade encontrada.</p>
        ) : (
          filtered.map(c => (
            <label key={c.id} className="flex min-w-0 items-center gap-2 py-1.5 px-1 rounded hover:bg-accent cursor-pointer text-sm">
              <input type="checkbox" checked={value.includes(c.id)} onChange={() => toggle(c.id)} className="h-4 w-4 shrink-0 rounded border-input" />
              <span className="min-w-0 break-words">{c.nome}</span>
            </label>
          ))
        )}
      </div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map(id => {
            const c = cidadeMap.get(id);
            return c ? (
              <Badge key={id} variant="secondary" className="gap-1 pr-1 max-w-full">
                <span className="min-w-0 truncate">{c.nome}</span>
                <button type="button" onClick={() => onChange(value.filter(v => v !== id))} className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ) : null;
          })}
        </div>
      )}
    </div>
  );
}

function PermissionsCheckboxes({ value, onChange }: {
  value: string[];
  onChange: (val: string[]) => void;
}) {
  const [search, setSearch] = useState("");

  const toggle = (key: string) => {
    onChange(value.includes(key) ? value.filter(v => v !== key) : [...value, key]);
  };

  const filtered = ALL_MODULES.filter(m =>
    m.label.toLowerCase().includes(search.trim().toLowerCase())
  );

  const allSelected = value.length === ALL_MODULES.length;
  const selectAll = () => onChange(allSelected ? [] : ALL_MODULES.map(m => m.key));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-sm font-medium">Módulos com Acesso</Label>
        <Button type="button" variant="outline" size="sm" onClick={selectAll} className="text-xs h-8">
          {allSelected ? "Desmarcar todos" : "Selecionar todos"}
        </Button>
      </div>
      <Input
        placeholder="Buscar módulo..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="h-9"
      />
      <div className="max-h-[45vh] min-h-[180px] overflow-y-auto overscroll-contain rounded-md border p-2 space-y-1">
        {filtered.length === 0 && (
          <p className="p-2 text-sm text-muted-foreground">Nenhum módulo encontrado.</p>
        )}
        {filtered.map(m => {
          const checked = value.includes(m.key);
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => toggle(m.key)}
              aria-pressed={checked}
              className={`flex w-full items-center gap-3 rounded-md px-2 py-2.5 text-left text-sm transition-colors ${
                checked ? "bg-primary/10 text-foreground" : "hover:bg-accent"
              }`}
            >
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                  checked ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background"
                }`}
              >
                {checked && <Check className="h-3.5 w-3.5" />}
              </span>
              <span className="flex-1">{m.label}</span>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        {value.length} de {ALL_MODULES.length} módulos selecionados
      </p>
    </div>
  );
}


function ActionIconButton({ label, onClick, disabled, children }: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
    >
      {children}
      <span className="text-[10px] leading-none text-muted-foreground">{label}</span>
    </button>
  );
}

const DELETE_ALLOWED_IDS = [
  "b42bdfd7-26d3-4f0b-814b-766a29c9deaa", // Gel Cardoso (super admin)
  "9c357e92-8a22-423c-a951-f28cd9996346", // Waiton Souza Oliveira
  "abd8f3d1-51be-4060-b04f-2c2dd6288bb1", // Felipe Carmona
];

export default function Usuarios() {
  const { user, userRole, isSuperAdmin } = useAuth();
  const isAdmin = userRole === "admin";
  const canDeleteUsers = !!user?.id && DELETE_ALLOWED_IDS.includes(user.id);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: users, isLoading } = useUsers();
  const { data: cidades = [] } = useCidades();

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [deleteUser, setDeleteUser] = useState<{ user_id: string; nome: string } | null>(null);
  const [resetPwdUser, setResetPwdUser] = useState<{ user_id: string; nome: string } | null>(null);
  const [editRoleUser, setEditRoleUser] = useState<{ user_id: string; nome: string; role: string | null } | null>(null);
  const [editCidadesUser, setEditCidadesUser] = useState<{ user_id: string; nome: string; cidades_ids: string[] } | null>(null);
  const [editNomeUser, setEditNomeUser] = useState<{ user_id: string; nome: string } | null>(null);
  const [editEmailUser, setEditEmailUser] = useState<{ user_id: string; nome: string; email: string } | null>(null);
  const [editEmailValue, setEditEmailValue] = useState("");
  const [editPermUser, setEditPermUser] = useState<{ user_id: string; nome: string; permissions: string[] } | null>(null);
  const [editCorUser, setEditCorUser] = useState<{ user_id: string; nome: string; cor: string | null } | null>(null);
  const [captacaoUser, setCaptacaoUser] = useState<{ user_id: string; nome: string; token: string | null } | null>(null);
  const [supportLink, setSupportLink] = useState<{ nome: string; email: string; url: string } | null>(null);
  const [userSearch, setUserSearch] = useState("");
  const { data: captadosByUserMap } = useEleitoresCaptadosCountByUsuario();

  // Ranking de captados por usuário
  const userRanking = useMemo(() => {
    if (!users || !captadosByUserMap) return new Map<string, number>();
    const sorted = users
      .map(u => ({ uid: u.user_id, count: captadosByUserMap.get(u.user_id) ?? 0 }))
      .filter(x => x.count > 0)
      .sort((a, b) => b.count - a.count);
    const map = new Map<string, number>();
    sorted.forEach((x, i) => map.set(x.uid, i + 1));
    return map;
  }, [users, captadosByUserMap]);
  const [editNomeValue, setEditNomeValue] = useState("");
  const [newNome, setNewNome] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("operador_cadastro");
  const [newCidadesIds, setNewCidadesIds] = useState<string[]>([]);
  const [newPermissions, setNewPermissions] = useState<string[]>([]);

  const cidadeMap = useMemo(() => new Map(cidades.map(c => [c.id, c.nome])), [cidades]);

  const filteredUsers = useMemo(() => {
    if (!userSearch.trim()) return users;
    const s = userSearch.trim().toLowerCase();
    return users?.filter((u: UserData) => u.nome.toLowerCase().includes(s));
  }, [users, userSearch]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("manage-users", {
        body: {
          action: "create",
          nome: newNome,
          email: newEmail,
          password: newPassword,
          role: newRole,
          cidades_ids: newCidadesIds,
          permissions: newRole === "admin" ? [] : newPermissions,
        },
      });
      if (error) {
        // Tenta extrair a mensagem real do corpo da resposta de erro (status não-2xx)
        let serverMsg: string | null = null;
        try {
          const ctx: any = (error as any).context;
          if (ctx?.json) {
            const body = await ctx.json();
            serverMsg = body?.error || null;
          } else if (ctx?.text) {
            const txt = await ctx.text();
            try { serverMsg = JSON.parse(txt)?.error ?? txt; } catch { serverMsg = txt; }
          }
        } catch { /* ignore */ }
        throw new Error(serverMsg || data?.error || error.message || "Erro ao criar usuário");
      }
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      toast({ title: "Usuário criado com sucesso!" });
      setShowAddDialog(false);
      setNewNome(""); setNewEmail(""); setNewPassword(""); setNewRole("operador_cadastro"); setNewCidadesIds([]); setNewPermissions([]);
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ["users-management"] }), 150);
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (user_id: string) => {
      const { data, error } = await supabase.functions.invoke("manage-users", {
        body: { action: "delete", user_id },
      });
      if (error) throw new Error(error.message || "Erro ao excluir usuário");
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      toast({ title: "Usuário excluído com sucesso!" });
      setDeleteUser(null);
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ["users-management"] }), 150);
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ user_id, role }: { user_id: string; role: string }) => {
      const { data, error } = await supabase.functions.invoke("manage-users", {
        body: { action: "update_role", user_id, role },
      });
      if (error) throw new Error(error.message || "Erro ao atualizar perfil");
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      toast({ title: "Perfil atualizado!" });
      setEditRoleUser(null);
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ["users-management"] }), 150);
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const updateNomeMutation = useMutation({
    mutationFn: async ({ user_id, nome }: { user_id: string; nome: string }) => {
      const { data, error } = await supabase.functions.invoke("manage-users", {
        body: { action: "update_nome", user_id, nome },
      });
      if (error) throw new Error(error.message || "Erro ao atualizar nome");
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      toast({ title: "Nome atualizado!" });
      setEditNomeUser(null);
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["users-management"] });
        queryClient.invalidateQueries({ queryKey: ["coordenadores"] });
      }, 150);
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const updateEmailMutation = useMutation({
    mutationFn: async ({ user_id, email }: { user_id: string; email: string }) => {
      const { data, error } = await supabase.functions.invoke("manage-users", {
        body: { action: "update_email", user_id, email },
      });
      if (error) {
        let serverMsg: string | null = null;
        try {
          const ctx: any = (error as any).context;
          if (ctx?.json) {
            const body = await ctx.json();
            serverMsg = body?.error || null;
          } else if (ctx?.text) {
            const txt = await ctx.text();
            try { serverMsg = JSON.parse(txt)?.error ?? txt; } catch { serverMsg = txt; }
          }
        } catch { /* ignore */ }
        throw new Error(serverMsg || data?.error || error.message || "Erro ao atualizar e-mail");
      }
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      toast({ title: "E-mail atualizado!" });
      setEditEmailUser(null);
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ["users-management"] }), 150);
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const sendInviteMutation = useMutation({
    mutationFn: async ({ user_id }: { user_id: string }) => {
      const { data, error } = await supabase.functions.invoke("manage-users", {
        body: { action: "send_invite", user_id },
      });
      if (error) {
        let serverMsg: string | null = null;
        try {
          const ctx: any = (error as any).context;
          if (ctx?.json) {
            const body = await ctx.json();
            serverMsg = body?.error || null;
          } else if (ctx?.text) {
            const txt = await ctx.text();
            try { serverMsg = JSON.parse(txt)?.error ?? txt; } catch { serverMsg = txt; }
          }
        } catch { /* ignore */ }
        throw new Error(serverMsg || data?.error || error.message || "Erro ao enviar convite");
      }
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data: any) => {
      toast({
        title: "Convite enviado!",
        description: data?.message || `E-mail de ativação enviado para ${data?.email || "o usuário"}.`,
      });
    },
    onError: (e: any) => toast({ title: "Erro ao enviar convite", description: e.message, variant: "destructive" }),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async ({ user_id }: { user_id: string }) => {
      const { data, error } = await supabase.functions.invoke("manage-users", {
        body: { action: "reset_password", user_id },
      });
      if (error) {
        let serverMsg: string | null = null;
        try {
          const ctx: any = (error as any).context;
          if (ctx?.json) { serverMsg = (await ctx.json())?.error || null; }
          else if (ctx?.text) {
            const txt = await ctx.text();
            try { serverMsg = JSON.parse(txt)?.error ?? txt; } catch { serverMsg = txt; }
          }
        } catch { /* ignore */ }
        throw new Error(serverMsg || data?.error || error.message || "Erro ao redefinir senha");
      }
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast({ title: "Senha redefinida!", description: "Nova senha: [senha temporária configurada na instalação]" });
      setResetPwdUser(null);
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const impersonateMutation = useMutation({
    mutationFn: async ({ user_id, nome }: { user_id: string; nome: string }) => {
      const { data, error } = await supabase.functions.invoke("manage-users", {
        body: { action: "impersonate", user_id },
      });
      if (error) {
        let serverMsg: string | null = null;
        try {
          const ctx: any = (error as any).context;
          if (ctx?.json) { serverMsg = (await ctx.json())?.error || null; }
          else if (ctx?.text) {
            const txt = await ctx.text();
            try { serverMsg = JSON.parse(txt)?.error ?? txt; } catch { serverMsg = txt; }
          }
        } catch { /* ignore */ }
        throw new Error(serverMsg || data?.error || error.message || "Erro ao abrir suporte");
      }
      if (data?.error) throw new Error(data.error);
      if (!data?.action_link) throw new Error("Link de suporte não disponível");
      return { ...data, nome } as { action_link: string; email: string; nome: string; target_origin?: string };
    },
    onSuccess: (data) => {
      window.open(data.action_link, "_blank", "noopener,noreferrer");
      toast({
        title: "Sessão de suporte aberta",
        description: `Nova aba aberta logada como ${data.nome} (${data.email}). Sua sessão de admin continua intacta aqui.`,
      });
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const updateCidadesMutation = useMutation({
    mutationFn: async ({ user_id, cidades_ids }: { user_id: string; cidades_ids: string[] }) => {
      const { data, error } = await supabase.functions.invoke("manage-users", {
        body: { action: "update_cidades", user_id, cidades_ids },
      });
      if (error) throw new Error(error.message || "Erro ao atualizar cidades");
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      toast({ title: "Cidades atualizadas!" });
      setEditCidadesUser(null);
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ["users-management"] }), 150);
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const updatePermMutation = useMutation({
    mutationFn: async ({ user_id, permissions }: { user_id: string; permissions: string[] }) => {
      const { data, error } = await supabase.functions.invoke("manage-users", {
        body: { action: "update_permissions", user_id, permissions },
      });
      if (error) throw new Error(error.message || "Erro ao atualizar permissões");
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      toast({ title: "Permissões atualizadas!" });
      setEditPermUser(null);
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["users-management"] });
        queryClient.invalidateQueries({ queryKey: ["user-permissions"] });
      }, 150);
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const PRESET_COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6", "#6366f1", "#f43f5e", "#0ea5e9", "#a855f7"];

  const usedColors = useMemo(() => {
    const map = new Map<string, string>();
    users?.forEach(u => { if (u.cor) map.set(u.cor.toLowerCase(), u.user_id); });
    return map;
  }, [users]);

  const updateCorMutation = useMutation({
    mutationFn: async ({ user_id, cor }: { user_id: string; cor: string | null }) => {
      const { data, error } = await supabase.functions.invoke("manage-users", {
        body: { action: "update_cor", user_id, cor },
      });
      if (error) throw new Error(error.message || "Erro ao atualizar cor");
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      toast({ title: "Cor atualizada!" });
      setEditCorUser(null);
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["users-management"] });
        queryClient.invalidateQueries({ queryKey: ["coordenadores"] });
      }, 150);
    },
    onError: (e: any) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6 w-full max-w-full">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Usuários</h1>
          <p className="text-muted-foreground">Gerenciamento de acessos e permissões</p>
        </div>
        {isSuperAdmin && (
          <Button onClick={() => setShowAddDialog(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Novo Usuário
          </Button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar usuário por nome..."
          value={userSearch}
          onChange={(e) => setUserSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      <Card className="w-full">
        <CardContent className="p-0">
          <div className="overflow-x-auto w-full">
            <Table className="w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[420px]">Nome / Ações</TableHead>
                  <TableHead className="w-auto">Email</TableHead>
                  <TableHead className="w-[130px]">Perfil</TableHead>
                  <TableHead className="w-[90px] text-center">Captados</TableHead>
                  <TableHead className="w-[70px] text-center">Ranking</TableHead>
                  <TableHead className="w-[200px]">Cidades</TableHead>
                  <TableHead className="w-[100px]">Módulos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : filteredUsers?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      {userSearch.trim() ? "Nenhum usuário encontrado para esta busca." : "Nenhum usuário cadastrado."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers?.map((u) => (
                    <TableRow key={u.user_id}>
                      <TableCell className="w-[420px] max-w-[420px] py-2 px-3">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <div
                              className="h-4 w-4 rounded-full border border-border shrink-0"
                              style={{ backgroundColor: u.cor || '#d1d5db' }}
                              title={u.cor || 'Sem cor'}
                            />
                            <div className="min-w-0">
                              <span className="font-medium text-sm truncate block">{u.nome}</span>
                              <span className="block text-[11px] text-muted-foreground">{roleLabels[u.role || ""] || "Sem perfil"}</span>
                            </div>
                          </div>
                          {isAdmin && (
                            <div className="flex items-center gap-0.5 flex-nowrap whitespace-nowrap pl-6 pb-1">
                              <ActionIconButton label="Nome" onClick={() => { setEditNomeUser({ user_id: u.user_id, nome: u.nome }); setEditNomeValue(u.nome); }}>
                                <Pencil className="h-3.5 w-3.5" />
                              </ActionIconButton>
                              <ActionIconButton label="E-mail" onClick={() => { setEditEmailUser({ user_id: u.user_id, nome: u.nome, email: u.email }); setEditEmailValue(u.email || ""); }} disabled={!isSuperAdmin}>
                                <Mail className="h-3.5 w-3.5" />
                              </ActionIconButton>
                              <ActionIconButton
                                label="Convite"
                                onClick={() => sendInviteMutation.mutate({ user_id: u.user_id })}
                                disabled={!isSuperAdmin || sendInviteMutation.isPending}
                              >
                                {sendInviteMutation.isPending && sendInviteMutation.variables?.user_id === u.user_id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Send className="h-3.5 w-3.5 text-primary" />
                                )}
                              </ActionIconButton>
                              <ActionIconButton label="Perfil" onClick={() => setEditRoleUser({ user_id: u.user_id, nome: u.nome, role: u.role })} disabled={!isSuperAdmin}>
                                <Shield className="h-3.5 w-3.5" />
                              </ActionIconButton>
                              <ActionIconButton label="Cidades" onClick={() => setEditCidadesUser({ user_id: u.user_id, nome: u.nome, cidades_ids: u.cidades_ids || [] })}>
                                <MapPin className="h-3.5 w-3.5" />
                              </ActionIconButton>
                              <ActionIconButton
                                label="Permissões"
                                onClick={async () => {
                                  const { data } = await supabase
                                    .from("user_permissions")
                                    .select("module")
                                    .eq("user_id", u.user_id);
                                  const perms = data
                                    ? Array.from(new Set(data.map((r: any) => r.module)))
                                    : (u.permissions || []);
                                  setEditPermUser({ user_id: u.user_id, nome: u.nome, permissions: perms });
                                }}
                                disabled={!isSuperAdmin}
                              >
                                <Lock className="h-3.5 w-3.5" />
                              </ActionIconButton>
                              <ActionIconButton label="Cor" onClick={() => setEditCorUser({ user_id: u.user_id, nome: u.nome, cor: u.cor })}>
                                <Palette className="h-3.5 w-3.5" />
                              </ActionIconButton>
                              <ActionIconButton label="Link" onClick={() => setCaptacaoUser({ user_id: u.user_id, nome: u.nome, token: u.token_publico })}>
                                <Link2 className="h-3.5 w-3.5 text-primary" />
                              </ActionIconButton>
                              <ActionIconButton
                                label="Resetar senha ([senha temporária configurada na instalação])"
                                onClick={() => setResetPwdUser({ user_id: u.user_id, nome: u.nome })}
                                disabled={!isSuperAdmin}
                              >
                                <KeyRound className="h-3.5 w-3.5 text-amber-600" />
                              </ActionIconButton>
                              <ActionIconButton
                                label="Suporte (entrar como este usuário em nova aba)"
                                onClick={() => impersonateMutation.mutate({ user_id: u.user_id, nome: u.nome })}
                                disabled={!isSuperAdmin || impersonateMutation.isPending}
                              >
                                {impersonateMutation.isPending && impersonateMutation.variables?.user_id === u.user_id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <LifeBuoy className="h-3.5 w-3.5 text-blue-600" />
                                )}
                              </ActionIconButton>
                              <ActionIconButton
                                label={u.role === "admin" && !isSuperAdmin ? "Apenas o super admin pode excluir ADM" : "Excluir"}
                                onClick={() => setDeleteUser({ user_id: u.user_id, nome: u.nome })}
                                disabled={!canDeleteUsers || u.user_id === user?.id || (u.role === "admin" && !isSuperAdmin)}
                              >
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </ActionIconButton>

                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground align-top text-xs py-2 px-3 truncate max-w-[220px]">{u.email}</TableCell>
                      <TableCell className="align-top py-2 px-3">
                        <Badge variant={roleBadgeVariant[u.role || ""] || "secondary"} className="text-[10px] px-1.5 py-0">
                          {roleLabels[u.role || ""] || "Sem perfil"}
                        </Badge>
                      </TableCell>
                      <TableCell className="align-top py-2 px-3 text-center">
                        {(() => {
                          const count = captadosByUserMap?.get(u.user_id) ?? 0;
                          return count > 0 ? (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{count}</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">0</span>
                          );
                        })()}
                      </TableCell>
                      <TableCell className="align-top py-2 px-3 text-center">
                        {(() => {
                          const rank = userRanking.get(u.user_id);
                          return rank ? (
                            <Badge variant={rank <= 3 ? "default" : "outline"} className="text-[10px] px-1.5 py-0">
                              {rank}º
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          );
                        })()}
                      </TableCell>
                      <TableCell className="align-top py-2 px-3">
                        {u.cidades_ids?.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {u.cidades_ids.slice(0, 2).map(id => (
                              <Badge key={id} variant="outline" className="text-[10px] px-1.5 py-0">
                                {cidadeMap.get(id) || "..."}
                              </Badge>
                            ))}
                            {u.cidades_ids.length > 2 && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">+{u.cidades_ids.length - 2}</Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="align-top py-2 px-3">
                        {u.permissions?.length > 0 ? (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{u.permissions.length} mód.</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Add User Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog} modal>
          <DialogContent onOpenAutoFocus={(e) => e.preventDefault()} className="flex max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] grid-rows-[auto_minmax(0,1fr)] flex-col overflow-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo Usuário</DialogTitle>
            <DialogDescription>Preencha os dados para criar um novo acesso ao sistema.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="flex min-h-0 flex-1 flex-col gap-4" autoComplete="off">
            <div className="min-h-0 flex-1 space-y-4 overflow-auto pr-1 sm:pr-2">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={newNome} onChange={(e) => setNewNome(e.target.value)} required autoComplete="off" name="new-user-nome" />
              </div>
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required autoComplete="new-email" name="new-user-email" />
              </div>
              <div className="space-y-2">
                <Label>Senha</Label>
                <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6} autoComplete="new-password" name="new-user-password" />
              </div>
              <div className="space-y-2">
                <Label>Perfil de Acesso</Label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="flex h-10 w-full items-center rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  {Object.entries(roleLabels).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Cidades Vinculadas</Label>
                <CidadesMultiSelect value={newCidadesIds} onChange={setNewCidadesIds} cidades={cidades} />
              </div>
              {newRole !== "admin" && (
                <PermissionsCheckboxes value={newPermissions} onChange={setNewPermissions} />
              )}
            </div>
            <DialogFooter className="shrink-0 pt-2">
              <Button type="submit" disabled={createMutation.isPending} className="w-full sm:w-auto">
                {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Criar Usuário
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Role Dialog */}
      <Dialog open={!!editRoleUser} onOpenChange={() => setEditRoleUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar Perfil</DialogTitle>
            <DialogDescription>Alterar o perfil de acesso de {editRoleUser?.nome}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <select
              value={editRoleUser?.role || ""}
              onChange={(e) => setEditRoleUser((prev) => prev ? { ...prev, role: e.target.value } : null)}
              className="flex h-10 w-full items-center rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <option value="" disabled>Selecione o perfil</option>
              {Object.entries(roleLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <DialogFooter>
              <Button
                onClick={() => editRoleUser && updateRoleMutation.mutate({ user_id: editRoleUser.user_id, role: editRoleUser.role! })}
                disabled={updateRoleMutation.isPending || !editRoleUser?.role}
              >
                {updateRoleMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Cities Dialog */}
      <Dialog open={!!editCidadesUser} onOpenChange={() => setEditCidadesUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cidades do Coordenador</DialogTitle>
            <DialogDescription>Gerenciar cidades vinculadas a {editCidadesUser?.nome}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <CidadesMultiSelect
              value={editCidadesUser?.cidades_ids || []}
              onChange={(cidades_ids) => setEditCidadesUser(prev => prev ? { ...prev, cidades_ids } : null)}
              cidades={cidades}
            />
            <DialogFooter>
              <Button
                onClick={() => editCidadesUser && updateCidadesMutation.mutate({ user_id: editCidadesUser.user_id, cidades_ids: editCidadesUser.cidades_ids })}
                disabled={updateCidadesMutation.isPending}
              >
                {updateCidadesMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Permissions Dialog */}
      <Dialog open={!!editPermUser} onOpenChange={() => setEditPermUser(null)}>
        <DialogContent className="flex max-h-[90dvh] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] flex-col overflow-hidden sm:max-w-lg">

          <DialogHeader>
            <DialogTitle>Permissões de Acesso</DialogTitle>
            <DialogDescription>Gerenciar módulos que {editPermUser?.nome} pode acessar</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            <PermissionsCheckboxes
              value={editPermUser?.permissions || []}
              onChange={(permissions) => setEditPermUser(prev => prev ? { ...prev, permissions } : null)}
            />
          </div>
          <DialogFooter className="shrink-0 pt-2">
            <Button
              className="w-full sm:w-auto"
              onClick={() => editPermUser && updatePermMutation.mutate({ user_id: editPermUser.user_id, permissions: editPermUser.permissions })}
              disabled={updatePermMutation.isPending}
            >
              {updatePermMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>

        </DialogContent>
      </Dialog>

      {/* Edit Nome Dialog */}
      <Dialog open={!!editNomeUser} onOpenChange={() => setEditNomeUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Nome</DialogTitle>
            <DialogDescription>Alterar o nome de {editNomeUser?.nome}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={editNomeValue} onChange={(e) => setEditNomeValue(e.target.value)} placeholder="Nome do usuário" minLength={2} />
            </div>
            <DialogFooter>
              <Button
                onClick={() => editNomeUser && updateNomeMutation.mutate({ user_id: editNomeUser.user_id, nome: editNomeValue })}
                disabled={updateNomeMutation.isPending || editNomeValue.trim().length < 2}
              >
                {updateNomeMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Email Dialog */}
      <Dialog open={!!editEmailUser} onOpenChange={() => setEditEmailUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar E-mail</DialogTitle>
            <DialogDescription>Atualizar o e-mail de login de {editEmailUser?.nome}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>E-mail atual</Label>
              <Input value={editEmailUser?.email || ""} disabled />
            </div>
            <div className="space-y-2">
              <Label>Novo e-mail</Label>
              <Input
                type="email"
                value={editEmailValue}
                onChange={(e) => setEditEmailValue(e.target.value)}
                placeholder="novo@email.com"
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">
                O usuário usará este novo e-mail para fazer login. A alteração é imediata e não exige confirmação por e-mail.
              </p>
            </div>
            <DialogFooter>
              <Button
                onClick={() => editEmailUser && updateEmailMutation.mutate({ user_id: editEmailUser.user_id, email: editEmailValue })}
                disabled={
                  updateEmailMutation.isPending ||
                  !editEmailValue.trim() ||
                  editEmailValue.trim().toLowerCase() === (editEmailUser?.email || "").toLowerCase()
                }
              >
                {updateEmailMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteUser} onOpenChange={() => setDeleteUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Usuário</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o usuário <strong>{deleteUser?.nome}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteUser && deleteMutation.mutate(deleteUser.user_id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset Password Confirmation */}
      <AlertDialog open={!!resetPwdUser} onOpenChange={() => setResetPwdUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Redefinir senha</AlertDialogTitle>
            <AlertDialogDescription>
              A senha de <strong>{resetPwdUser?.nome}</strong> será redefinida para <strong>[senha temporária configurada na instalação]</strong>. O usuário poderá entrar imediatamente e alterar depois.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); resetPwdUser && resetPasswordMutation.mutate({ user_id: resetPwdUser.user_id }); }}
            >
              {resetPasswordMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Redefinir para [senha temporária configurada na instalação]
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Support / Impersonate Dialog */}
      <Dialog open={!!supportLink} onOpenChange={() => setSupportLink(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LifeBuoy className="h-5 w-5 text-blue-600" /> Acesso de Suporte
            </DialogTitle>
            <DialogDescription>
              Link gerado para entrar como <strong>{supportLink?.nome}</strong> ({supportLink?.email}).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-md border border-amber-500/50 bg-amber-50 dark:bg-amber-950/20 p-3 text-sm space-y-2">
              <p className="font-semibold text-amber-900 dark:text-amber-200">⚠️ Importante — abra em janela anônima</p>
              <p className="text-amber-800 dark:text-amber-300">
                Se você abrir este link na mesma janela em que está logado, sua sessão de admin será <strong>substituída</strong> pela do usuário (e fica tela em branco pedindo login).
              </p>
              <p className="text-amber-800 dark:text-amber-300">
                <strong>Solução:</strong> abra uma janela anônima (<kbd className="px-1 rounded bg-amber-200 dark:bg-amber-800 text-xs">Ctrl+Shift+N</kbd> no Chrome, <kbd className="px-1 rounded bg-amber-200 dark:bg-amber-800 text-xs">Ctrl+Shift+P</kbd> no Firefox) e cole o link lá. Sua sessão de admin nesta janela continua intacta.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Link de acesso (válido por ~1 hora):</Label>
              <div className="flex gap-2">
                <Input readOnly value={supportLink?.url || ""} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (supportLink?.url) {
                      navigator.clipboard.writeText(supportLink.url);
                      toast({ title: "Link copiado!", description: "Cole em uma janela anônima." });
                    }
                  }}
                >
                  Copiar
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSupportLink(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>



      {/* Edit Color Dialog */}
      <Dialog open={!!editCorUser} onOpenChange={() => setEditCorUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cor de Identificação</DialogTitle>
            <DialogDescription>Selecione a cor para {editCorUser?.nome}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-6 gap-2">
              {PRESET_COLORS.map(c => {
                const takenBy = usedColors.get(c.toLowerCase());
                const isTaken = takenBy && takenBy !== editCorUser?.user_id;
                const takenUser = isTaken ? users?.find(u => u.user_id === takenBy) : null;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      if (isTaken) {
                        toast({ title: "Cor em uso", description: `Essa cor já está sendo usada por ${takenUser?.nome || 'outro usuário'}`, variant: "destructive" });
                        return;
                      }
                      setEditCorUser(prev => prev ? { ...prev, cor: c } : null);
                    }}
                    className={`h-10 w-full rounded-md border-2 transition-all relative ${editCorUser?.cor === c ? 'border-foreground scale-110' : isTaken ? 'border-transparent opacity-40 cursor-not-allowed' : 'border-transparent hover:scale-105'}`}
                    style={{ backgroundColor: c }}
                    title={isTaken ? `Em uso por ${takenUser?.nome}` : ''}
                  >
                    {isTaken && <X className="h-4 w-4 text-white absolute inset-0 m-auto drop-shadow" />}
                  </button>
                );
              })}
            </div>
            {(() => {
              const selectedColor = editCorUser?.cor?.toLowerCase();
              const takenBy = selectedColor ? usedColors.get(selectedColor) : undefined;
              const isDuplicate = takenBy && takenBy !== editCorUser?.user_id;
              return isDuplicate ? (
                <p className="text-sm text-destructive font-medium">⚠ Esta cor já está sendo usada por outro usuário</p>
              ) : null;
            })()}
            <div className="flex items-center gap-2">
              <Label className="text-sm shrink-0">Personalizada:</Label>
              <input
                type="color"
                value={editCorUser?.cor || '#3b82f6'}
                onChange={(e) => setEditCorUser(prev => prev ? { ...prev, cor: e.target.value } : null)}
                className="h-10 w-16 rounded cursor-pointer border border-input"
              />
              <div className="h-10 w-10 rounded-full border border-border" style={{ backgroundColor: editCorUser?.cor || '#d1d5db' }} />
              <Button variant="ghost" size="sm" onClick={() => setEditCorUser(prev => prev ? { ...prev, cor: null } : null)} className="text-xs">
                Limpar
              </Button>
            </div>
            <DialogFooter>
              <Button
                onClick={() => {
                  if (!editCorUser) return;
                  const selColor = editCorUser.cor?.toLowerCase();
                  const takenBy = selColor ? usedColors.get(selColor) : undefined;
                  if (takenBy && takenBy !== editCorUser.user_id) {
                    toast({ title: "Cor duplicada", description: "Escolha uma cor que não esteja em uso por outro usuário", variant: "destructive" });
                    return;
                  }
                  updateCorMutation.mutate({ user_id: editCorUser.user_id, cor: editCorUser.cor });
                }}
                disabled={updateCorMutation.isPending}
              >
                {updateCorMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Captação de Eleitores Dialog */}
      <Dialog open={!!captacaoUser} onOpenChange={() => setCaptacaoUser(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Link de Captação de Leads</DialogTitle>
            <DialogDescription>
              {captacaoUser?.nome} pode usar este link/QR Code em campo para cadastrar apoiadores. Cada apoiador cadastrado conta como 1 apoiador e fica registrado com a origem (este usuário).
            </DialogDescription>
          </DialogHeader>
          <CaptacaoLinkPanel
            token={captacaoUser?.token}
            liderancaNome={captacaoUser?.nome || ""}
            variant="usuario"
            totalCaptados={
              captacaoUser ? (captadosByUserMap?.get(captacaoUser.user_id) ?? 0) : 0
            }
          />
          {captacaoUser && isSuperAdmin && (
            <VinculoLiderancaSection userId={captacaoUser.user_id} userNome={captacaoUser.nome} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function VinculoLiderancaSection({ userId, userNome }: { userId: string; userNome: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string>("");

  const { data: profile } = useQuery({
    queryKey: ["profile-vinc-lider", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("lideranca_vinculada_id")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return data as { lideranca_vinculada_id: string | null } | null;
    },
  });

  const { data: liderancas } = useQuery({
    queryKey: ["liderancas-opt-vinc"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("liderancas")
        .select("id, nome")
        .order("nome");
      if (error) throw error;
      return data as { id: string; nome: string }[];
    },
  });

  const current = profile?.lideranca_vinculada_id ?? "";
  const effective = selected || current;

  const saveMut = useMutation({
    mutationFn: async (newId: string | null) => {
      const { error } = await supabase
        .from("profiles")
        .update({ lideranca_vinculada_id: newId })
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Vínculo atualizado", description: "As captações deste usuário passarão a contar para a liderança selecionada." });
      qc.invalidateQueries({ queryKey: ["profile-vinc-lider", userId] });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const options = (liderancas || []).map((l) => ({ value: l.id, label: l.nome }));

  return (
    <div className="rounded-lg border bg-muted/30 p-4 space-y-2 mt-2">
      <Label className="text-sm font-semibold">Vincular a uma liderança</Label>
      <p className="text-xs text-muted-foreground">
        Quando vinculado, cada apoiador captado por {userNome} soma também para a liderança escolhida (e para o coordenador dela).
      </p>
      <SearchSelect
        value={effective}
        onChange={setSelected}
        options={options}
        placeholder="Selecione uma liderança..."
        searchPlaceholder="Buscar liderança..."
        allowClear
        clearLabel="Remover vínculo"
      />
      <div className="flex gap-2 justify-end pt-1">
        <Button
          type="button"
          size="sm"
          onClick={() => saveMut.mutate(effective ? effective : null)}
          disabled={saveMut.isPending || effective === current}
        >
          {saveMut.isPending && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
          Salvar vínculo
        </Button>
      </div>
    </div>
  );
}

