import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  MessageCircle, Loader2, Save, Plug, CheckCircle2, XCircle, Eye, EyeOff, Info,
} from "lucide-react";

const SETTING_KEYS = [
  "evolution_api_url",
  "evolution_webhook_url",
  "evolution_default_instance_prefix",
  "evolution_default_delay_ms",
  "evolution_max_instances_per_user",
];

export function WhatsAppPanel() {
  const queryClient = useQueryClient();
  const [testing, setTesting] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [form, setForm] = useState<Record<string, string>>({});

  const { data: settings, isLoading: loadingSettings } = useQuery({
    queryKey: ["evolution-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("key,value")
        .in("key", SETTING_KEYS);
      if (error) throw error;
      const map: Record<string, string> = {};
      (data || []).forEach((r: any) => (map[r.key] = r.value || ""));
      return map;
    },
  });

  const { data: secretRow, isLoading: loadingSecret } = useQuery({
    queryKey: ["evolution-api-key"],
    queryFn: async () => {
      const { data } = await supabase
        .from("integration_secrets")
        .select("id,key_value")
        .eq("service", "evolution")
        .eq("key_name", "EVOLUTION_API_KEY")
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (settings) setForm({ ...settings });
  }, [settings]);
  useEffect(() => {
    if (secretRow?.key_value) setApiKey(secretRow.key_value);
  }, [secretRow]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Upsert app_settings
      for (const key of SETTING_KEYS) {
        const value = form[key] ?? "";
        const { data: exists } = await supabase
          .from("app_settings").select("id").eq("key", key).maybeSingle();
        if (exists) {
          await supabase.from("app_settings").update({ value, updated_at: new Date().toISOString() }).eq("key", key);
        } else {
          await supabase.from("app_settings").insert({ key, value });
        }
      }
      // Upsert secret
      if (secretRow?.id) {
        await supabase.from("integration_secrets")
          .update({ key_value: apiKey || null, is_active: true, updated_at: new Date().toISOString() })
          .eq("id", secretRow.id);
      } else {
        await supabase.from("integration_secrets").insert({
          service: "evolution", key_name: "EVOLUTION_API_KEY",
          key_value: apiKey || null, is_active: true,
          description: "API key da Evolution API (auto-hospedada)",
        });
      }
    },
    onSuccess: () => {
      toast.success("Configurações salvas");
      queryClient.invalidateQueries({ queryKey: ["evolution-settings"] });
      queryClient.invalidateQueries({ queryKey: ["evolution-api-key"] });
    },
    onError: (e: any) => toast.error(e.message || "Erro ao salvar"),
  });

  const testConnection = async () => {
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-evolution", {
        body: { action: "test-connection" },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Falha");
      toast.success("Conexão com a Evolution API OK");
    } catch (e: any) {
      toast.error(e.message || "Falha na conexão");
    } finally {
      setTesting(false);
    }
  };

  if (loadingSettings || loadingSecret) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin inline mr-2" /> Carregando...
        </CardContent>
      </Card>
    );
  }

  const configured = !!form.evolution_api_url && !!apiKey;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <MessageCircle className="h-6 w-6 text-primary" />
              <div>
                <CardTitle>WhatsApp — Evolution API</CardTitle>
                <CardDescription>
                  Integração via QR Code. Cada usuário conecta o próprio WhatsApp na página <strong>WhatsApp</strong> do menu.
                </CardDescription>
              </div>
            </div>
            <Badge variant={configured ? "default" : "secondary"}>
              {configured ? (<><CheckCircle2 className="h-3 w-3 mr-1" /> Configurada</>) : (<><XCircle className="h-3 w-3 mr-1" /> Pendente</>)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Como funciona</AlertTitle>
            <AlertDescription className="text-xs">
              Aponte para uma instalação própria da Evolution API. A API Key é enviada no header{" "}
              <code>apikey</code> em todas as chamadas. O webhook será registrado automaticamente
              para cada nova instância criada pelos usuários.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label>URL da Evolution API *</Label>
            <Input
              placeholder="https://evolution.suaempresa.com"
              value={form.evolution_api_url || ""}
              onChange={(e) => setForm({ ...form, evolution_api_url: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">Sem barra no final. Ex: https://evo.exemplo.com</p>
          </div>

          <div className="space-y-2">
            <Label>API Key *</Label>
            <div className="flex gap-2">
              <Input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Sua API Key global da Evolution"
                autoComplete="off"
              />
              <Button type="button" variant="outline" size="icon" onClick={() => setShowKey(!showKey)}>
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Webhook Base URL</Label>
            <Input
              placeholder="Deixe vazio para usar o webhook interno"
              value={form.evolution_webhook_url || ""}
              onChange={(e) => setForm({ ...form, evolution_webhook_url: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Padrão: endpoint interno <code>/functions/v1/whatsapp-webhook</code>. Só altere se estiver usando um proxy próprio.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Prefixo das instâncias</Label>
              <Input
                value={form.evolution_default_instance_prefix || ""}
                onChange={(e) => setForm({ ...form, evolution_default_instance_prefix: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Delay padrão (ms)</Label>
              <Input
                type="number"
                value={form.evolution_default_delay_ms || ""}
                onChange={(e) => setForm({ ...form, evolution_default_delay_ms: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Máx. conexões por usuário</Label>
              <Input
                type="number"
                value={form.evolution_max_instances_per_user || ""}
                onChange={(e) => setForm({ ...form, evolution_max_instances_per_user: e.target.value })}
              />
            </div>
          </div>

          <Separator />

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
              Salvar
            </Button>
            <Button variant="outline" onClick={testConnection} disabled={testing || !configured}>
              {testing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plug className="h-4 w-4 mr-1" />}
              Testar Conexão
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
