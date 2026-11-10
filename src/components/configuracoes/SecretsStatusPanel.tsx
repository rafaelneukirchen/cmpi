import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { KeyRound, CheckCircle2, XCircle, AlertTriangle, RefreshCw, ExternalLink, Loader2, ShieldCheck, ShieldAlert, MinusCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type DiagnosticCheck = {
  id: string;
  label: string;
  status: "ok" | "error" | "warning" | "skipped";
  message: string;
  hint?: string;
  details?: any;
};

type DiagnosticResult = {
  success: boolean;
  summary: {
    can_auto_renew: boolean;
    total: number;
    ok: number;
    errors: number;
    warnings: number;
  };
  checks: DiagnosticCheck[];
};

type SecretStatus = {
  key: string;
  label: string;
  description: string;
  required: boolean;
  configured: boolean;
  module: string;
  docsUrl?: string;
  // optional live check
  liveStatus?: "ok" | "error" | "unknown";
  liveMessage?: string;
};

/**
 * Centralized panel showing the status of every API token / secret used by the platform.
 * Visible only to admins. Tokens are NEVER exposed — we only show "configured" / "missing" / "expired".
 */
export function SecretsStatusPanel() {
  const [checking, setChecking] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Live check for Instagram token (calls instagram-insights edge function)
  const { data: igCheck, refetch: refetchIg, isFetching: checkingIg } = useQuery({
    queryKey: ["secret-check", "instagram"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("instagram-insights", { body: {} });
      if (error) return { ok: false, message: error.message };
      if (data?.success === false) return { ok: false, message: data?.error || "Token inválido ou expirado" };
      return {
        ok: true,
        message: data?.profile?.username ? `Conectado como @${data.profile.username}` : "Token válido",
      };
    },
    staleTime: 1000 * 60 * 5,
    retry: false,
  });

  // Query DB to know which secrets exist via system_api_credentials (for admin-managed ones)
  const { data: dbCreds, refetch: refetchDbCreds } = useQuery({
    queryKey: ["api-credentials-secrets-panel"],
    queryFn: async () => {
      const { data } = await supabase
        .from("system_api_credentials" as any)
        .select("plataforma, status, expiracao_token");
      return (data || []) as any[];
    },
  });

  const igCredential = dbCreds?.find((c) => c.plataforma === "instagram");
  const igExpiresAt = igCredential?.expiracao_token ? new Date(igCredential.expiracao_token) : null;
  const daysUntilExpiry = igExpiresAt
    ? Math.round((igExpiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  // Diagnostic query — validates APP_ID, APP_SECRET, token and their compatibility
  const {
    data: diag,
    refetch: refetchDiag,
    isFetching: diagLoading,
  } = useQuery<DiagnosticResult>({
    queryKey: ["instagram-diagnostic"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("diagnose-instagram-credentials", { body: {} });
      if (error) throw error;
      return data as DiagnosticResult;
    },
    staleTime: 1000 * 60 * 2,
    retry: false,
  });

  const canAutoRenew = diag?.summary?.can_auto_renew === true;

  const handleManualRefresh = async () => {
    if (!canAutoRenew) {
      toast.error("Corrija os erros do diagnóstico antes de tentar renovar.");
      return;
    }
    setRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke("refresh-instagram-token", { body: {} });
      if (error) throw error;
      if (data?.success === false) throw new Error(data?.error || "Falha ao renovar token");
      toast.success(
        `Token renovado! Válido por ~${data?.expires_in_days || 60} dias.`,
        { duration: 5000 }
      );
      await Promise.all([refetchDbCreds(), refetchIg(), refetchDiag()]);
    } catch (err: any) {
      toast.error(`Erro ao renovar: ${err?.message || "desconhecido"}`);
    } finally {
      setRefreshing(false);
    }
  };

  // Build the list of known platform secrets.
  // We can't read process.env from the client, so we infer "configured" from:
  // - live check (Instagram)
  // - presence in system_api_credentials table
  // For backend-only secrets we mark them as "managed in backend" and provide an update CTA.
  const secrets: SecretStatus[] = [
    {
      key: "INSTAGRAM_ACCESS_TOKEN",
      label: "Instagram / Meta Graph API",
      description: "Token de acesso usado para coletar métricas, posts e comentários do perfil do Instagram.",
      required: true,
      module: "Radar Social",
      configured: igCheck?.ok ?? true, // assume configured unless live check fails
      liveStatus: igCheck ? (igCheck.ok ? "ok" : "error") : "unknown",
      liveMessage: igCheck?.message,
      docsUrl: "https://developers.facebook.com/tools/explorer/",
    },
    {
      key: "SERPAPI_KEY",
      label: "SerpAPI (Google Trends)",
      description: "Coleta de tendências do Google para o módulo de Inteligência de Campanha.",
      required: false,
      module: "Inteligência de Campanha",
      configured: true, // backend-managed; user can update via secret tool
      docsUrl: "https://serpapi.com/manage-api-key",
    },
    {
      key: "NEWS_API_KEY",
      label: "News API",
      description: "Notícias políticas para o módulo de Inteligência de Campanha.",
      required: false,
      module: "Inteligência de Campanha",
      configured: true,
      docsUrl: "https://newsapi.org/account",
    },
    {
      key: "LOVABLE_API_KEY",
      label: "Lovable AI Gateway",
      description: "Chave para geração de temas de campanha e análises por IA. Provisionada automaticamente.",
      required: false,
      module: "Inteligência de Campanha",
      configured: true,
    },
  ];

  const issues = secrets.filter((s) => s.liveStatus === "error" || (s.required && !s.configured));

  const openSecretsManager = (secretName: string) => {
    toast.info(
      `Para atualizar "${secretName}", use a opção "Atualizar token" ao lado do item.`,
      { duration: 4000 }
    );
  };

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <KeyRound className="h-4 w-4" />
          Tokens & Chaves de API
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Visão centralizada de todas as integrações. Atualize aqui quando algum token estiver expirado ou em alerta.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Issues banner */}
        {issues.length > 0 && (
          <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>{issues.length} integração(ões) precisam de atenção</AlertTitle>
            <AlertDescription>
              {issues.map((s) => (
                <div key={s.key} className="text-xs mt-1">
                  • <strong>{s.label}</strong>: {s.liveMessage || "Token ausente ou inválido"}
                </div>
              ))}
            </AlertDescription>
          </Alert>
        )}

        {/* Live check refresh */}
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setChecking(true);
              refetchIg().finally(() => setChecking(false));
            }}
            disabled={checkingIg || checking}
          >
            {checkingIg || checking ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3 mr-1" />
            )}
            Verificar status agora
          </Button>
        </div>

        {/* Compatibility diagnostic */}
        <div className="rounded-lg border bg-card p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {canAutoRenew ? (
                <ShieldCheck className="h-4 w-4 text-primary" />
              ) : (
                <ShieldAlert className="h-4 w-4 text-destructive" />
              )}
              <p className="text-sm font-medium">
                Diagnóstico de compatibilidade (APP_ID + APP_SECRET + Token)
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => refetchDiag()}
              disabled={diagLoading}
            >
              {diagLoading ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3 mr-1" />
              )}
              Rodar diagnóstico
            </Button>
          </div>

          {diag && (
            <>
              <div className="text-xs text-muted-foreground">
                {canAutoRenew ? (
                  <span className="text-primary font-medium">
                    ✓ Tudo pronto — renovação automática habilitada.
                  </span>
                ) : (
                  <span className="text-destructive font-medium">
                    ✗ {diag.summary.errors} erro(s) encontrado(s) — corrija antes de tentar renovar.
                  </span>
                )}
              </div>
              <div className="space-y-1">
                {diag.checks.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-start gap-2 text-xs border-l-2 pl-2 py-1"
                    style={{
                      borderLeftColor:
                        c.status === "ok"
                          ? "hsl(var(--primary))"
                          : c.status === "error"
                          ? "hsl(var(--destructive))"
                          : c.status === "warning"
                          ? "hsl(var(--accent))"
                          : "hsl(var(--muted))",
                    }}
                  >
                    {c.status === "ok" && <CheckCircle2 className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />}
                    {c.status === "error" && <XCircle className="h-3.5 w-3.5 text-destructive mt-0.5 shrink-0" />}
                    {c.status === "warning" && <AlertTriangle className="h-3.5 w-3.5 text-accent-foreground mt-0.5 shrink-0" />}
                    {c.status === "skipped" && <MinusCircle className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{c.label}</p>
                      <p className={c.status === "error" ? "text-destructive" : "text-muted-foreground"}>
                        {c.message}
                      </p>
                      {c.hint && c.status !== "ok" && (
                        <p className="text-muted-foreground italic mt-0.5">💡 {c.hint}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          {!diag && !diagLoading && (
            <p className="text-xs text-muted-foreground">
              Clique em "Rodar diagnóstico" para verificar se os secrets e o token estão compatíveis.
            </p>
          )}
        </div>

        {/* Auto-renewal banner for Instagram token */}
        <Alert className={
          daysUntilExpiry !== null && daysUntilExpiry < 7
            ? "border-destructive/50 bg-destructive/10"
            : "border-primary/30 bg-primary/5"
        }>
          <RefreshCw className="h-4 w-4" />
          <AlertTitle className="text-sm">Renovação automática do Instagram</AlertTitle>
          <AlertDescription className="text-xs space-y-2">
            <p>
              O token é renovado automaticamente a cada 7 dias (estende +60 dias por renovação).
              {igExpiresAt && (
                <>
                  {" "}Última validade conhecida:{" "}
                  <strong>
                    {igExpiresAt.toLocaleDateString("pt-BR")}{" "}
                    {daysUntilExpiry !== null && (
                      <span className={daysUntilExpiry < 7 ? "text-destructive" : "text-muted-foreground"}>
                        ({daysUntilExpiry} dias restantes)
                      </span>
                    )}
                  </strong>
                </>
              )}
              {!igExpiresAt && " Ainda não houve nenhuma renovação registrada — clique em \"Renovar agora\" para começar."}
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={handleManualRefresh}
              disabled={refreshing || !canAutoRenew}
              title={!canAutoRenew ? "Corrija o diagnóstico antes de renovar" : ""}
            >
              {refreshing ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3 mr-1" />
              )}
              Renovar agora
            </Button>
          </AlertDescription>
        </Alert>

        {/* Secrets list */}
        <div className="space-y-2">
          {secrets.map((s) => (
            <div
              key={s.key}
              className="flex items-start justify-between gap-3 rounded-lg border p-3 bg-muted/30"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-sm">{s.label}</p>
                  <StatusBadge status={s} />
                  <Badge variant="outline" className="text-[10px]">
                    {s.module}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{s.description}</p>
                {s.liveMessage && (
                  <p
                    className={`text-xs mt-1 ${
                      s.liveStatus === "ok" ? "text-primary" : "text-destructive"
                    }`}
                  >
                    {s.liveStatus === "ok" ? "✓" : "✗"} {s.liveMessage}
                  </p>
                )}
                <code className="text-[10px] text-muted-foreground mt-1 block">{s.key}</code>
              </div>
              <div className="flex flex-col gap-2 shrink-0">
                {s.docsUrl && (
                  <a
                    href={s.docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    Obter token <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                <Button
                  size="sm"
                  variant={s.liveStatus === "error" ? "destructive" : "outline"}
                  onClick={() => openSecretsManager(s.key)}
                  className="text-xs"
                >
                  Atualizar token
                </Button>
              </div>
            </div>
          ))}
        </div>

        <Alert className="bg-muted/50">
          <KeyRound className="h-4 w-4" />
          <AlertDescription className="text-xs">
            <strong>Como atualizar um token:</strong> peça ao assistente da Lovable "atualizar o secret X"
            indicando o nome (ex.: <code>INSTAGRAM_ACCESS_TOKEN</code>). O valor é armazenado de forma segura
            no backend e nunca aparece no código.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: SecretStatus }) {
  if (status.liveStatus === "error") {
    return (
      <Badge variant="destructive" className="text-[10px]">
        <XCircle className="h-3 w-3 mr-1" /> Erro
      </Badge>
    );
  }
  if (status.liveStatus === "ok") {
    return (
      <Badge className="bg-primary text-primary-foreground text-[10px]">
        <CheckCircle2 className="h-3 w-3 mr-1" /> Ativo
      </Badge>
    );
  }
  if (status.configured) {
    return (
      <Badge variant="secondary" className="text-[10px]">
        <CheckCircle2 className="h-3 w-3 mr-1" /> Configurado
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-[10px]">
      <XCircle className="h-3 w-3 mr-1" /> Não configurado
    </Badge>
  );
}
