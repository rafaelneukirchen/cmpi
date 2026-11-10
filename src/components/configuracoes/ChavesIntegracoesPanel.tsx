import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import {
  KeyRound,
  Eye,
  EyeOff,
  Save,
  CheckCircle2,
  XCircle,
  ExternalLink,
  MessageCircle,
  Instagram,
  Newspaper,
  Info,
  Plug,
  Loader2,
} from "lucide-react";

type IntegrationSecret = {
  id: string;
  service: string;
  key_name: string;
  key_value: string | null;
  description: string | null;
  is_active: boolean;
};

type ServiceGroup = {
  service: string;
  title: string;
  icon: React.ReactNode;
  description: string;
  docsUrl?: string;
  helpText?: string;
};

const SERVICE_GROUPS: ServiceGroup[] = [
  {
    service: "instagram",
    title: "Instagram / Meta Graph API",
    icon: <Instagram className="h-5 w-5 text-primary" />,
    description: "Radar Social, widget de perfil e insights do Instagram",
    docsUrl: "https://developers.facebook.com/docs/instagram-api",
    helpText:
      "Crie um App em Meta for Developers, conecte sua conta Instagram Business e gere um Access Token de longa duração (60 dias, com renovação automática).",
  },
  {
    service: "inteligencia",
    title: "Inteligência de Campanha",
    icon: <Newspaper className="h-5 w-5 text-primary" />,
    description: "Notícias políticas e tendências do Google",
    helpText:
      "NEWS_API_KEY: cadastre-se em newsapi.org. SERPAPI_KEY: cadastre-se em serpapi.com (ambos têm planos gratuitos).",
  },
];


function maskValue(value: string | null): string {
  if (!value) return "";
  if (value.length <= 4) return "••••";
  return "••••••" + value.slice(-4);
}

function SecretRow({ secret, onSave }: { secret: IntegrationSecret; onSave: (id: string, value: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [showValue, setShowValue] = useState(false);
  const [newValue, setNewValue] = useState("");
  const [saving, setSaving] = useState(false);

  const isConfigured = !!secret.key_value && secret.key_value.length > 0;

  const handleSave = async () => {
    if (!newValue.trim()) {
      toast.error("Informe um valor para a chave");
      return;
    }
    setSaving(true);
    try {
      await onSave(secret.id, newValue.trim());
      toast.success(`${secret.key_name} salvo com sucesso`);
      setEditing(false);
      setNewValue("");
      setShowValue(false);
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    if (!confirm(`Remover o valor de ${secret.key_name}?`)) return;
    setSaving(true);
    try {
      await onSave(secret.id, "");
      toast.success("Valor removido");
    } catch (e: any) {
      toast.error(e.message || "Erro ao remover");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Label className="font-mono text-sm">{secret.key_name}</Label>
            {isConfigured ? (
              <Badge variant="default">
                <CheckCircle2 className="h-3 w-3 mr-1" /> Configurado
              </Badge>
            ) : (
              <Badge variant="destructive">
                <XCircle className="h-3 w-3 mr-1" /> Não configurado
              </Badge>
            )}
          </div>
          {secret.description && (
            <p className="text-xs text-muted-foreground mt-1">{secret.description}</p>
          )}
        </div>
      </div>

      {editing ? (
        <div className="space-y-2">
          <div className="relative">
            <Input
              type={showValue ? "text" : "password"}
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              placeholder="Cole aqui o novo valor..."
              autoComplete="off"
              className="pr-10 font-mono text-sm"
            />
            <button
              type="button"
              onClick={() => setShowValue(!showValue)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showValue ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-1" /> Salvar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setEditing(false);
                setNewValue("");
                setShowValue(false);
              }}
              disabled={saving}
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 flex-wrap">
          <Input
            readOnly
            value={isConfigured ? maskValue(secret.key_value) : "(vazio)"}
            className="font-mono text-sm bg-muted/40 flex-1 min-w-[200px]"
          />
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            {isConfigured ? "Alterar" : "Adicionar"}
          </Button>
          {isConfigured && (
            <Button size="sm" variant="ghost" onClick={handleClear} disabled={saving}>
              Limpar
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// WhatsApp Meta connection test removed — replaced by Evolution API flow (see /whatsapp page).


export function ChavesIntegracoesPanel() {
  const queryClient = useQueryClient();

  const { data: secrets, isLoading } = useQuery({
    queryKey: ["integration-secrets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("integration_secrets")
        .select("*")
        .order("service")
        .order("key_name");
      if (error) throw error;
      return data as IntegrationSecret[];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: string }) => {
      const { error } = await supabase
        .from("integration_secrets")
        .update({ key_value: value || null, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integration-secrets"] });
    },
  });

  const handleSave = async (id: string, value: string) => {
    await updateMutation.mutateAsync({ id, value });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground text-sm">
          Carregando chaves...
        </CardContent>
      </Card>
    );
  }

  const totalConfigured = secrets?.filter((s) => s.key_value).length || 0;
  const totalKeys = secrets?.length || 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <KeyRound className="h-6 w-6 text-primary" />
              <div>
                <CardTitle>Chaves & Integrações</CardTitle>
                <CardDescription>
                  Cadastre as credenciais necessárias para as integrações funcionarem neste sistema
                </CardDescription>
              </div>
            </div>
            <Badge variant={totalConfigured === totalKeys ? "default" : "secondary"} className="text-sm">
              {totalConfigured} / {totalKeys} configuradas
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Como funciona</AlertTitle>
            <AlertDescription className="text-sm">
              Todas as chaves cadastradas aqui são armazenadas com segurança no banco de dados e
              acessíveis apenas por administradores. Os valores são mascarados após salvar (mostra
              apenas os últimos 4 caracteres). Sem essas chaves, as integrações correspondentes não
              funcionarão.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {SERVICE_GROUPS.map((group) => {
        const groupSecrets = secrets?.filter((s) => s.service === group.service) || [];
        const groupConfigured = groupSecrets.filter((s) => s.key_value).length;
        const allConfigured = groupConfigured === groupSecrets.length && groupSecrets.length > 0;

        return (
          <Card key={group.service}>
            <CardHeader>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  {group.icon}
                  <div>
                    <CardTitle className="text-lg">{group.title}</CardTitle>
                    <CardDescription>{group.description}</CardDescription>
                  </div>
                </div>
                <Badge variant={allConfigured ? "default" : "secondary"}>
                  {groupConfigured} / {groupSecrets.length}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {group.helpText && (
                <Alert variant="default" className="bg-muted/40">
                  <Info className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    {group.helpText}
                    {group.docsUrl && (
                      <a
                        href={group.docsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 ml-2 text-primary hover:underline"
                      >
                        Documentação <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </AlertDescription>
                </Alert>
              )}
              <Separator />
              <div className="space-y-3">
                {groupSecrets.map((secret) => (
                  <SecretRow key={secret.id} secret={secret} onSave={handleSave} />
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
