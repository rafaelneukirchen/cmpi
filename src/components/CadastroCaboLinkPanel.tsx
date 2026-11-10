import { useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Copy, Download, QrCode, Share2, UserPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  liderancaId: string | null | undefined;
  token: string | null | undefined;
  liderancaNome: string;
  initialEnabled: boolean;
  onChanged?: (enabled: boolean) => void;
}

export function CadastroCaboLinkPanel({ liderancaId, token, liderancaNome, initialEnabled, onChanged }: Props) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [saving, setSaving] = useState(false);
  const [showQr, setShowQr] = useState(false);

  if (!liderancaId || !token) {
    return (
      <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
        Salve a liderança para liberar o link de cadastro de cabos.
      </div>
    );
  }

  const PUBLIC_DOMAIN = "https://voto-compass.lovable.app";
  const origin = window.location.origin;
  const isSandbox =
    origin.includes("lovableproject.com") ||
    origin.includes("id-preview--") ||
    origin.includes("localhost");
  const baseUrl = isSandbox ? PUBLIC_DOMAIN : origin;
  const url = `${baseUrl}/cabo/cadastro/${token}`;

  async function toggle(value: boolean) {
    setSaving(true);
    const { error } = await supabase
      .from("liderancas")
      .update({ permite_cadastro_cabos: value } as never)
      .eq("id", liderancaId!);
    setSaving(false);
    if (error) {
      toast.error("Não foi possível atualizar: " + error.message);
      return;
    }
    setEnabled(value);
    onChanged?.(value);
    toast.success(value ? "Cadastro de cabos liberado." : "Cadastro de cabos bloqueado.");
  }

  function copy() {
    navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  }

  function shareWhatsapp() {
    const msg = encodeURIComponent(
      `Olá! Use este link para se cadastrar como Cabo Eleitoral da liderança ${liderancaNome}:\n${url}`,
    );
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  }

  function downloadQr() {
    const canvas = document.getElementById(`qr-cabo-${token}`) as HTMLCanvasElement | null;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `qr-cabo-${liderancaNome.replace(/\s+/g, "_")}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  return (
    <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-primary" />
          <h4 className="font-semibold text-sm">Link de Cadastro de Cabos</h4>
        </div>
        <div className="flex items-center gap-2">
          {saving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
          <Switch checked={enabled} onCheckedChange={toggle} disabled={saving} />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Quando liberado, esta liderança pode compartilhar o link/QR para pessoas se cadastrarem como Cabo Eleitoral. Cada cabo cadastrado ganha acesso para captar apoiadores — as captações sobem para o cabo, a liderança e o coordenador.
      </p>

      {enabled && (
        <>
          <div>
            <Label className="text-xs">Link público</Label>
            <div className="flex gap-2 mt-1">
              <Input value={url} readOnly className="font-mono text-xs" onFocus={(e) => e.target.select()} />
              <Button type="button" size="icon" variant="outline" onClick={copy} title="Copiar link">
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setShowQr((v) => !v)}>
              <QrCode className="h-4 w-4 mr-1" />
              {showQr ? "Ocultar QR" : "Mostrar QR Code"}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={shareWhatsapp}>
              <Share2 className="h-4 w-4 mr-1" />
              Enviar por WhatsApp
            </Button>
          </div>

          {showQr && (
            <div className="flex flex-col items-center gap-2 pt-2 border-t">
              <div className="bg-white p-3 rounded-lg">
                <QRCodeCanvas id={`qr-cabo-${token}`} value={url} size={180} level="H" includeMargin={false} />
              </div>
              <Button type="button" size="sm" variant="ghost" onClick={downloadQr}>
                <Download className="h-4 w-4 mr-1" />
                Baixar QR Code
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
