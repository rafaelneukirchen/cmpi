import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MapPin, Shield, Clock, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";
import { Device } from "@capacitor/device";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const TERMS_VERSION = "v1";
const TERMS_TEXT = `TERMO DE CONSENTIMENTO PARA COMPARTILHAMENTO DE LOCALIZAÇÃO

Ao aceitar este termo, você autoriza o sistema Voto Compass a coletar, armazenar e compartilhar com a coordenação da campanha as seguintes informações do dispositivo onde o aplicativo está instalado:

1. COORDENADAS GEOGRÁFICAS (latitude e longitude)
2. PRECISÃO da localização capturada
3. HORÁRIO da captura
4. NÍVEL DE BATERIA do dispositivo (opcional)

PERIODICIDADE: A localização será capturada e enviada a cada 15 minutos, durante 24 horas por dia, enquanto o aplicativo estiver instalado e este consentimento ativo.

FINALIDADE: O dado é utilizado exclusivamente pela coordenação para acompanhar a presença e atuação da equipe nos pontos de campanha designados.

ACESSO AOS DADOS: Apenas você (próprio dado) e os administradores da campanha têm acesso ao seu histórico de localização.

REVOGAÇÃO: Você pode revogar este consentimento a qualquer momento nas Configurações do aplicativo. Após a revogação, novas coletas serão interrompidas imediatamente.

LGPD: Esta coleta está em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).`;

export function LocationConsentDialog() {
  const { user, userRole, isSuperAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  const { data: consent, isLoading } = useQuery({
    queryKey: ["user-location-consent", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("user_location_consent")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    // Exigido no app nativo e também no navegador para todos abaixo de admin
    const requiresConsent = Capacitor.isNativePlatform() || !(userRole === "admin" || isSuperAdmin);
    if (!isLoading && user && requiresConsent && !(consent as any)?.is_active) {
      setOpen(true);
    } else if ((consent as any)?.is_active) {
      setOpen(false);
    }
  }, [isLoading, consent, user, userRole, isSuperAdmin]);


  async function handleAccept() {
    if (!accepted || !user) return;
    setSaving(true);

    try {
      // 1. Solicita permissão nativa — se for NEGADA, não salva consentimento
      // Assim, na próxima sessão o modal aparece de novo.
      let permissionGranted = false;
      try {
        if (Capacitor.isNativePlatform()) {
          const res = await Geolocation.requestPermissions({ permissions: ["location", "coarseLocation"] });
          permissionGranted = res.location === "granted" || res.coarseLocation === "granted";
        } else {
          // Web: força o prompt do navegador chamando getCurrentPosition
          await new Promise<void>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
              () => {
                permissionGranted = true;
                resolve();
              },
              (err) => reject(err),
              { enableHighAccuracy: true, timeout: 15000 }
            );
          });
        }
      } catch (e: any) {
        permissionGranted = false;
      }

      if (!permissionGranted) {
        toast.error(
          "Permissão negada pelo navegador/dispositivo. Habilite a localização nas configurações e tente novamente.",
          { duration: 6000 }
        );
        setSaving(false);
        return; // NÃO salva — modal continuará aparecendo em próximos logins
      }

      // 2. Coleta info do dispositivo
      let deviceInfo = "Web Browser";
      if (Capacitor.isNativePlatform()) {
        try {
          const info = await Device.getInfo();
          deviceInfo = `${info.manufacturer} ${info.model} (${info.platform} ${info.osVersion})`;
        } catch {}
      } else {
        deviceInfo = navigator.userAgent;
      }

      // 3. Salva consentimento de forma permanente (upsert — evita erro de duplicidade)
      const { data: saved, error } = await supabase
        .from("user_location_consent")
        .upsert(
          {
            user_id: user.id,
            is_active: true,
            revoked_at: null,
            frequency_minutes: 15,
            terms_version: TERMS_VERSION,
            terms_text: TERMS_TEXT,
            device_info: deviceInfo,
          },
          { onConflict: "user_id" }
        )
        .select()
        .maybeSingle();

      if (error) throw error;

      // Fecha imediatamente e já popula o cache para não voltar a pedir
      setOpen(false);
      queryClient.setQueryData(["user-location-consent", user.id], saved ?? { user_id: user.id, is_active: true, frequency_minutes: 15 });
      queryClient.invalidateQueries({ queryKey: ["user-location-consent"] });
      toast.success("Compartilhamento ativado! Você não será questionado novamente.");
    } catch (err: any) {
      toast.error(err.message || "Erro ao registrar consentimento");
    } finally {
      setSaving(false);
    }
  }

  if (isLoading || !user) return null;

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <MapPin className="h-6 w-6 text-primary" />
            Compartilhamento de Localização
          </DialogTitle>
          <DialogDescription>
            Para utilizar o sistema, é necessário autorizar o compartilhamento da sua localização com a coordenação da campanha.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-4">
          <div className="border rounded-lg p-3 bg-muted/30">
            <Shield className="h-5 w-5 text-primary mb-2" />
            <p className="text-xs font-medium">Dados Protegidos</p>
            <p className="text-xs text-muted-foreground">Apenas admins veem</p>
          </div>
          <div className="border rounded-lg p-3 bg-muted/30">
            <Clock className="h-5 w-5 text-primary mb-2" />
            <p className="text-xs font-medium">A cada 15 min</p>
            <p className="text-xs text-muted-foreground">24h por dia</p>
          </div>
          <div className="border rounded-lg p-3 bg-muted/30">
            <AlertCircle className="h-5 w-5 text-primary mb-2" />
            <p className="text-xs font-medium">Revogável</p>
            <p className="text-xs text-muted-foreground">A qualquer momento</p>
          </div>
        </div>

        <ScrollArea className="h-64 border rounded-md p-4 bg-muted/20">
          <pre className="text-xs whitespace-pre-wrap font-sans leading-relaxed">{TERMS_TEXT}</pre>
        </ScrollArea>

        <div className="flex items-start gap-2 mt-4 p-3 border rounded-md bg-primary/5">
          <Checkbox
            id="accept-terms"
            checked={accepted}
            onCheckedChange={(v) => setAccepted(v === true)}
          />
          <label htmlFor="accept-terms" className="text-sm leading-relaxed cursor-pointer">
            Li e <strong>aceito</strong> compartilhar minha localização em tempo real com a coordenação da campanha conforme os termos acima.
          </label>
        </div>

        <DialogFooter className="mt-4">
          <Button onClick={handleAccept} disabled={!accepted || saving} className="w-full sm:w-auto">
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Aceitar e Ativar Compartilhamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
