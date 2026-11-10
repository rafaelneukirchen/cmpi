import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { KeyRound, Shield, Trash2, Pencil, CheckCircle2, XCircle, Clock, AlertTriangle } from "lucide-react";
import {
  useApiCredentials, useUpsertApiCredential, useDeleteApiCredential,
  PLATAFORMAS, type ApiCredential,
} from "@/hooks/useRadarSocial";
import { format, differenceInDays } from "date-fns";

function CredentialFormDialog({
  existing,
  plataforma,
  onClose,
}: {
  existing?: ApiCredential;
  plataforma: string;
  onClose: () => void;
}) {
  const [accessToken, setAccessToken] = useState(existing?.access_token || "");
  const [refreshToken, setRefreshToken] = useState(existing?.refresh_token || "");
  const [expiracao, setExpiracao] = useState(
    existing?.expiracao_token ? existing.expiracao_token.slice(0, 16) : ""
  );
  const [status, setStatus] = useState(existing?.status || "ativo");
  const upsertMut = useUpsertApiCredential();

  const plat = PLATAFORMAS.find((p) => p.key === plataforma);

  const handleSubmit = async () => {
    if (!accessToken.trim()) {
      toast.error("Access Token é obrigatório");
      return;
    }
    try {
      await upsertMut.mutateAsync({
        plataforma,
        access_token: accessToken.trim(),
        refresh_token: refreshToken.trim() || undefined,
        expiracao_token: expiracao ? new Date(expiracao).toISOString() : undefined,
        status,
      });
      toast.success(`Credencial ${existing ? "atualizada" : "salva"} para ${plat?.label || plataforma}`);
      onClose();
    } catch {
      toast.error("Erro ao salvar credencial");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xl">{plat?.icon}</span>
        <h3 className="font-semibold">{plat?.label || plataforma}</h3>
      </div>

      <div>
        <Label>Access Token *</Label>
        <Input
          type="password"
          value={accessToken}
          onChange={(e) => setAccessToken(e.target.value)}
          placeholder="Cole o access token aqui"
          autoComplete="off"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Token de acesso da API oficial da plataforma
        </p>
      </div>

      <div>
        <Label>Refresh Token</Label>
        <Input
          type="password"
          value={refreshToken}
          onChange={(e) => setRefreshToken(e.target.value)}
          placeholder="Opcional - para renovação automática"
          autoComplete="off"
        />
      </div>

      <div>
        <Label>Expiração do Token</Label>
        <Input
          type="datetime-local"
          value={expiracao}
          onChange={(e) => setExpiracao(e.target.value)}
        />
      </div>

      <div className="flex items-center justify-between">
        <Label>Status</Label>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {status === "ativo" ? "Ativo" : "Inativo"}
          </span>
          <Switch
            checked={status === "ativo"}
            onCheckedChange={(checked) => setStatus(checked ? "ativo" : "inativo")}
          />
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <DialogClose asChild>
          <Button variant="outline" className="flex-1">Cancelar</Button>
        </DialogClose>
        <Button onClick={handleSubmit} disabled={upsertMut.isPending} className="flex-1">
          {upsertMut.isPending ? "Salvando..." : existing ? "Atualizar" : "Salvar"}
        </Button>
      </div>
    </div>
  );
}

function StatusBadge({ credential }: { credential?: ApiCredential }) {
  if (!credential) {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        <XCircle className="h-3 w-3 mr-1" /> Não configurado
      </Badge>
    );
  }

  if (credential.status !== "ativo") {
    return (
      <Badge variant="secondary">
        <XCircle className="h-3 w-3 mr-1" /> Inativo
      </Badge>
    );
  }

  if (credential.expiracao_token && new Date(credential.expiracao_token) < new Date()) {
    return (
      <Badge variant="destructive">
        <Clock className="h-3 w-3 mr-1" /> Expirado
      </Badge>
    );
  }

  return (
    <Badge className="bg-emerald-600 hover:bg-emerald-700">
      <CheckCircle2 className="h-3 w-3 mr-1" /> Ativo
    </Badge>
  );
}

export default function ApiConfigPanel() {
  const { data: credentials, isLoading } = useApiCredentials();
  const deleteMut = useDeleteApiCredential();
  const [editPlataforma, setEditPlataforma] = useState<string | null>(null);

  const getCredential = (plataforma: string) =>
    credentials?.find((c) => c.plataforma === plataforma);

  const handleDelete = async (plataforma: string) => {
    const plat = PLATAFORMAS.find((p) => p.key === plataforma);
    if (!confirm(`Remover credencial de ${plat?.label || plataforma}?`)) return;
    try {
      await deleteMut.mutateAsync(plataforma);
      toast.success("Credencial removida");
    } catch {
      toast.error("Erro ao remover");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}
      </div>
    );
  }

  const activeCount = PLATAFORMAS.filter((p) => {
    const c = getCredential(p.key);
    return c && c.status === "ativo";
  }).length;

  // Check for expired or expiring-soon tokens
  const expiredTokens = PLATAFORMAS.filter((p) => {
    const c = getCredential(p.key);
    return c && c.status === "ativo" && c.expiracao_token && new Date(c.expiracao_token) < new Date();
  });

  const expiringSoonTokens = PLATAFORMAS.filter((p) => {
    const c = getCredential(p.key);
    if (!c || c.status !== "ativo" || !c.expiracao_token) return false;
    const days = differenceInDays(new Date(c.expiracao_token), new Date());
    return days >= 0 && days <= 7;
  });

  return (
    <div className="space-y-6">
      {/* Expired tokens alert */}
      {expiredTokens.length > 0 && (
        <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Tokens expirados!</AlertTitle>
          <AlertDescription>
            {expiredTokens.map((p) => {
              const c = getCredential(p.key);
              return (
                <div key={p.key} className="flex items-center gap-2 mt-1">
                  <span>{p.icon}</span>
                  <span className="font-medium">{p.label}</span>
                  <span className="text-xs">— expirou em {c?.expiracao_token ? format(new Date(c.expiracao_token), "dd/MM/yyyy HH:mm") : ""}</span>
                </div>
              );
            })}
            <p className="mt-2 text-xs">Atualize os tokens para continuar coletando dados automaticamente.</p>
          </AlertDescription>
        </Alert>
      )}

      {/* Expiring soon alert */}
      {expiringSoonTokens.length > 0 && (
        <Alert className="border-yellow-500/50 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 [&>svg]:text-yellow-600">
          <Clock className="h-4 w-4" />
          <AlertTitle>Tokens próximos da expiração</AlertTitle>
          <AlertDescription>
            {expiringSoonTokens.map((p) => {
              const c = getCredential(p.key);
              const days = c?.expiracao_token ? differenceInDays(new Date(c.expiracao_token), new Date()) : 0;
              return (
                <div key={p.key} className="flex items-center gap-2 mt-1">
                  <span>{p.icon}</span>
                  <span className="font-medium">{p.label}</span>
                  <span className="text-xs">— expira em {days} {days === 1 ? "dia" : "dias"}</span>
                </div>
              );
            })}
            <p className="mt-2 text-xs">Renove os tokens em breve para evitar interrupções na coleta.</p>
          </AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4 flex items-start gap-4">
          <div className="p-3 rounded-lg bg-primary/10">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold">Configuração Global de APIs</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Configure as credenciais das APIs das redes sociais. Apenas uma credencial por plataforma.
              Os tokens são armazenados de forma segura e nunca expostos no frontend.
            </p>
            <div className="flex gap-3 mt-3">
              <Badge variant="outline">
                {activeCount} de {PLATAFORMAS.length} plataformas ativas
              </Badge>
              {expiredTokens.length > 0 && (
                <Badge variant="destructive">
                  {expiredTokens.length} token{expiredTokens.length > 1 ? "s" : ""} expirado{expiredTokens.length > 1 ? "s" : ""}
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Platform cards */}
      <div className="grid gap-4">
        {PLATAFORMAS.map((plat) => {
          const cred = getCredential(plat.key);
          return (
            <Card key={plat.key} className="border-l-4" style={{ borderLeftColor: plat.color }}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{plat.icon}</span>
                    <div>
                      <p className="font-semibold">{plat.label}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <StatusBadge credential={cred} />
                        {cred?.expiracao_token && cred.status === "ativo" && (
                          <span className="text-xs text-muted-foreground">
                            Expira: {format(new Date(cred.expiracao_token), "dd/MM/yyyy HH:mm")}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Dialog
                      open={editPlataforma === plat.key}
                      onOpenChange={(open) => setEditPlataforma(open ? plat.key : null)}
                    >
                      <DialogTrigger asChild>
                        <Button size="sm" variant={cred ? "outline" : "default"}>
                          {cred ? (
                            <><Pencil className="h-3 w-3 mr-1" /> Editar</>
                          ) : (
                            <><KeyRound className="h-3 w-3 mr-1" /> Configurar</>
                          )}
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>
                            {cred ? "Editar Credencial" : "Configurar API"}
                          </DialogTitle>
                        </DialogHeader>
                        <CredentialFormDialog
                          existing={cred}
                          plataforma={plat.key}
                          onClose={() => setEditPlataforma(null)}
                        />
                      </DialogContent>
                    </Dialog>

                    {cred && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(plat.key)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>

                {cred && (
                  <div className="mt-3 pt-3 border-t grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-muted-foreground">
                    <div>
                      <p className="font-medium text-foreground">Access Token</p>
                      <p>••••••••{cred.access_token.slice(-6)}</p>
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Refresh Token</p>
                      <p>{cred.refresh_token ? `••••••••${cred.refresh_token.slice(-6)}` : "Não configurado"}</p>
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Expiração</p>
                      <p>{cred.expiracao_token ? format(new Date(cred.expiracao_token), "dd/MM/yyyy HH:mm") : "Sem expiração"}</p>
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Status</p>
                      <p className={cred.status === "ativo" ? "text-emerald-600" : "text-destructive"}>
                        {cred.status === "ativo" ? "Ativo" : "Inativo"}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Help section */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Como obter as credenciais?</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="flex gap-2">
              <span>📸</span>
              <div>
                <p className="font-medium text-foreground">Instagram / Facebook</p>
                <p>Acesse o <a href="https://developers.facebook.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">Meta for Developers</a>, crie um App e gere um token de acesso com permissões de leitura.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <span>▶️</span>
              <div>
                <p className="font-medium text-foreground">YouTube</p>
                <p>Acesse o <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">Google Cloud Console</a>, ative a YouTube Data API v3 e crie uma chave de API.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <span>🐦</span>
              <div>
                <p className="font-medium text-foreground">X (Twitter)</p>
                <p>Acesse o <a href="https://developer.x.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">X Developer Portal</a> e gere um Bearer Token (plano Basic ou superior).</p>
              </div>
            </div>
            <div className="flex gap-2">
              <span>🎵</span>
              <div>
                <p className="font-medium text-foreground">TikTok</p>
                <p>Acesse o <a href="https://developers.tiktok.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">TikTok for Developers</a> e solicite acesso à API de pesquisa.</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
