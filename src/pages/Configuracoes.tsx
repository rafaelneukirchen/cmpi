import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAppSettings, useUpdateAppSetting, useUploadAppAsset } from "@/hooks/useAppSettings";
import { Loader2, Upload, Trash2, Image, AlertTriangle, Archive, Plus, Target, Lock } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import ApiConfigPanel from "@/components/ApiConfigPanel";
import { SecretsStatusPanel } from "@/components/configuracoes/SecretsStatusPanel";
import { ChavesIntegracoesPanel } from "@/components/configuracoes/ChavesIntegracoesPanel";
import { WhatsAppPanel } from "@/components/configuracoes/WhatsAppPanel";
import { IdentidadeVisualSection } from "@/components/configuracoes/IdentidadeVisualSection";
import { LandingPageSection } from "@/components/configuracoes/LandingPageSection";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { SetupInicialPanel } from "@/components/configuracoes/SetupInicialPanel";

function ImageUploadCard({
  label,
  description,
  settingKey,
  currentUrl,
}: {
  label: string;
  description: string;
  settingKey: string;
  currentUrl: string | null | undefined;
}) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadAsset = useUploadAppAsset();
  const updateSetting = useUpdateAppSetting();

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione apenas arquivos de imagem");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${settingKey}.${ext}`;
      const publicUrl = await uploadAsset.mutateAsync({ file, path });
      await updateSetting.mutateAsync({ key: settingKey, value: publicUrl });
      toast.success(`${label} atualizado com sucesso!`);
    } catch (err: any) {
      toast.error(err.message || "Erro ao fazer upload");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleRemove = async () => {
    try {
      await updateSetting.mutateAsync({ key: settingKey, value: null });
      toast.success(`${label} removido`);
    } catch (err: any) {
      toast.error(err.message || "Erro ao remover");
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Image className="h-4 w-4" />
          {label}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {currentUrl && (
          <div className="relative rounded-lg border bg-muted/50 p-4 flex items-center justify-center">
            <img
              src={currentUrl}
              alt={label}
              className="max-h-40 max-w-full object-contain rounded"
            />
          </div>
        )}
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleUpload}
          />
          <Button
            variant="outline"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex-1"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            {currentUrl ? "Trocar imagem" : "Enviar imagem"}
          </Button>
          {currentUrl && (
            <Button variant="destructive" size="icon" onClick={handleRemove}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function CampanhaSection() {
  const { userRole } = useAuth();
  const isAdmin = userRole === "admin";
  const queryClient = useQueryClient();
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetConfirm, setResetConfirm] = useState("");
  const [campanhaNome, setCampanhaNome] = useState("");
  const [campanhaAno, setCampanhaAno] = useState(new Date().getFullYear());

  const { data: campanhas, isLoading } = useQuery({
    queryKey: ["campanhas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("campanhas").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("campanhas").insert({ nome: campanhaNome, ano: campanhaAno });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Campanha criada!");
      queryClient.invalidateQueries({ queryKey: ["campanhas"] });
      setShowNewDialog(false);
      setCampanhaNome("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("reset-campaign", { body: {} });
      if (error) throw error;
      if (data?.success === false) throw new Error(data.error || "Erro ao resetar");
    },
    onSuccess: () => {
      toast.success("Sistema zerado! Pronto para começar do zero.");
      queryClient.invalidateQueries();
      setShowResetDialog(false);
      setResetConfirm("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!isAdmin) return null;

  const ativa = campanhas?.find((c) => c.status === "ativa");

  return (
    <>
      <Card className="border-destructive/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Archive className="h-4 w-4" />
            Campanhas
          </CardTitle>
          <p className="text-sm text-muted-foreground">Gerencie campanhas e resete o sistema para um novo ciclo eleitoral</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : (
            <>
              {ativa && (
                <div className="rounded-lg border bg-muted/50 p-3">
                  <p className="text-sm font-medium">Campanha ativa: <span className="text-primary">{ativa.nome} ({ativa.ano})</span></p>
                </div>
              )}
              {campanhas && campanhas.filter((c) => c.status === "arquivada").length > 0 && (
                <div className="text-xs text-muted-foreground">
                  {campanhas.filter((c) => c.status === "arquivada").length} campanha(s) arquivada(s)
                </div>
              )}
            </>
          )}
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={() => setShowNewDialog(true)} className="gap-2">
              <Plus className="h-4 w-4" /> Nova Campanha
            </Button>
            <Button variant="destructive" onClick={() => setShowResetDialog(true)} className="gap-2">
              <AlertTriangle className="h-4 w-4" /> Resetar Sistema
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Campanha</DialogTitle>
            <DialogDescription>Defina o nome e ano da campanha vigente.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={campanhaNome} onChange={(e) => setCampanhaNome(e.target.value)} placeholder="Ex: Eleição 2026" required />
            </div>
            <div className="space-y-2">
              <Label>Ano</Label>
              <Input type="number" value={campanhaAno} onChange={(e) => setCampanhaAno(Number(e.target.value))} required />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Criar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showResetDialog} onOpenChange={(open) => { setShowResetDialog(open); if (!open) setResetConfirm(""); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> Resetar Sistema
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>Esta ação irá <strong>apagar definitivamente todos os dados operacionais</strong> do sistema, deixando o esqueleto pronto para começar do zero.</p>
                <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
                  <p className="font-semibold text-destructive mb-1">Será apagado:</p>
                  <p className="text-xs">Cidades, lideranças, apoiadores captados, dobradinhas, projeções, agenda, visitas, estrutura, equipe, GPS, logística (materiais/movimentações/pessoas), financeiro, contatos, dados sociais coletados, auditoria e campanhas arquivadas.</p>
                </div>
                <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
                  <p className="font-semibold text-primary mb-1">Será preservado:</p>
                  <p className="text-xs">Usuários e permissões, identidade visual (logo, cor, nome, favicon, fundo), termos/privacidade, integrações (Instagram, Facebook, APIs), licenças e a estrutura completa do sistema.</p>
                </div>
                <p className="font-medium mt-2">Digite <strong>RESETAR</strong> para confirmar:</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input value={resetConfirm} onChange={(e) => setResetConfirm(e.target.value)} placeholder="RESETAR" className="mt-2" />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => resetMutation.mutate()}
              disabled={resetConfirm !== "RESETAR" || resetMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {resetMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirmar Reset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function MetaGeralSection({ settings }: { settings: Record<string, string | null> | undefined }) {
  const [meta, setMeta] = useState("");
  const [saving, setSaving] = useState(false);
  const updateSetting = useUpdateAppSetting();

  useEffect(() => {
    if (settings?.meta_geral_votos) {
      setMeta(settings.meta_geral_votos);
    }
  }, [settings?.meta_geral_votos]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSetting.mutateAsync({ key: "meta_geral_votos", value: meta || "0" });
      toast.success("Meta geral atualizada!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar meta");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Target className="h-4 w-4" />
          Meta Geral da Campanha
        </CardTitle>
        <p className="text-sm text-muted-foreground">Defina a meta total de apoiadores que a campanha deve alcançar</p>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-3">
          <div className="flex-1 space-y-2">
            <Label>Meta de Apoiadores</Label>
            <Input
              type="number"
              min={0}
              placeholder="Ex: 500000"
              value={meta}
              onChange={e => setMeta(e.target.value)}
            />
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Salvar
          </Button>
        </div>
        {meta && Number(meta) > 0 && (
          <p className="mt-2 text-sm text-muted-foreground">
            Meta: <strong>{Number(meta).toLocaleString('pt-BR')}</strong> apoiadores
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function useWhatsAppReady() {
  const { data } = useQuery({
    queryKey: ["whatsapp-ready-evolution"],
    queryFn: async () => {
      const [urlRes, keyRes] = await Promise.all([
        supabase.from("app_settings").select("value").eq("key", "evolution_api_url").maybeSingle(),
        supabase.from("integration_secrets").select("key_value")
          .eq("service", "evolution").eq("key_name", "EVOLUTION_API_KEY").maybeSingle(),
      ]);
      return !!urlRes.data?.value && !!keyRes.data?.key_value;
    },
    refetchInterval: 10000,
  });
  return !!data;
}


export default function Configuracoes() {
  const { data: settings, isLoading } = useAppSettings();
  const { userRole } = useAuth();
  const isAdmin = userRole === "admin";
  const whatsappReady = useWhatsAppReady();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground">Personalize a aparência do sistema e gerencie integrações</p>
      </div>

      <Tabs defaultValue="geral">
        <div className="overflow-x-auto -mx-1 px-1">
          <TabsList className="w-max">
            <TabsTrigger value="geral">⚙️ Geral</TabsTrigger>
            {isAdmin && <TabsTrigger value="marca">🎨 Identidade Visual</TabsTrigger>}
            {isAdmin && <TabsTrigger value="landing">📣 Landing Page</TabsTrigger>}
            {isAdmin && <TabsTrigger value="integracoes">🔑 Integrações & Tokens</TabsTrigger>}
            {isAdmin && (
              <TabsTrigger value="whatsapp" className="gap-1">
                {whatsappReady ? "💬" : "⚙️"} WhatsApp
              </TabsTrigger>
            )}

          </TabsList>
        </div>

        <TabsContent value="geral" className="mt-4 space-y-6">
          {isAdmin && <SetupInicialPanel />}
          <MetaGeralSection settings={settings} />
          <div className="grid gap-6 md:grid-cols-2">
            <ImageUploadCard
              label="Logo"
              description="Exibido na sidebar e cabeçalho do sistema"
              settingKey="app_logo"
              currentUrl={settings?.app_logo}
            />
            <ImageUploadCard
              label="Imagem de Fundo"
              description="Exibida como plano de fundo em todas as páginas"
              settingKey="app_background"
              currentUrl={settings?.app_background}
            />
          </div>
          <CampanhaSection />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="marca" className="mt-4 space-y-6">
            <IdentidadeVisualSection settings={settings} />
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="landing" className="mt-4 space-y-6">
            <LandingPageSection settings={settings} />
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="integracoes" className="mt-4 space-y-6">
            <ChavesIntegracoesPanel />
            <Separator />
            <SecretsStatusPanel />
            <div className="border-t pt-6">
              <h2 className="text-lg font-semibold mb-1">Credenciais Avançadas (refresh tokens)</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Tokens com renovação automática (Instagram OAuth de longa duração)
              </p>
              <ApiConfigPanel />
            </div>
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="whatsapp" className="mt-4 space-y-6">
            <WhatsAppPanel />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
