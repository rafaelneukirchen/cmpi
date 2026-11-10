import { useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy, Download, QrCode, Share2, Users } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface CaptacaoLinkPanelProps {
  token: string | null | undefined;
  liderancaNome: string;
  totalCaptados?: number;
  /** Tipo de captador para diferenciar o slug da URL: 'lideranca' usa /captar/, 'usuario' usa /captar-u/ (mas o backend aceita ambos via mesmo endpoint público v2). */
  variant?: "lideranca" | "usuario";
}

export function CaptacaoLinkPanel({ token, liderancaNome, totalCaptados = 0, variant = "lideranca" }: CaptacaoLinkPanelProps) {
  const [showQr, setShowQr] = useState(false);

  if (!token) {
    return (
      <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
        {variant === "usuario"
          ? "Link de captação será gerado automaticamente para este usuário."
          : "Salve a liderança para gerar o link de captação em campo."}
      </div>
    );
  }

  // ambos vão para /captar/:token — o backend (RPC v2) reconhece se é token de liderança ou de usuário
  // O preview do sandbox exige login do Lovable; sempre apontamos para o domínio publicado.
  const PUBLIC_DOMAIN = "https://voto-compass.lovable.app";
  const origin = window.location.origin;
  const isSandbox =
    origin.includes("lovableproject.com") ||
    origin.includes("id-preview--") ||
    origin.includes("localhost");
  const baseUrl = isSandbox ? PUBLIC_DOMAIN : origin;
  const url = `${baseUrl}/captar/${token}`;

  function copy() {
    navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  }

  function shareWhatsapp() {
    const msg = encodeURIComponent(
      `Olá! Use este link para cadastrar apoiadores em campo (${liderancaNome}):\n${url}`
    );
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  }

  function downloadQr() {
    const canvas = document.getElementById(`qr-${token}`) as HTMLCanvasElement | null;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `qr-${liderancaNome.replace(/\s+/g, "_")}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  return (
    <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          <h4 className="font-semibold text-sm">Captação de Leads em Campo</h4>
        </div>
        <Badge variant="secondary" className="gap-1">
          {totalCaptados} captado{totalCaptados !== 1 ? "s" : ""}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        Compartilhe este link/QR Code{variant === "usuario" ? "" : " com a liderança"}. Cada apoiador cadastrado conta como 1 apoiador e soma automaticamente ao total.
      </p>

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
            <QRCodeCanvas id={`qr-${token}`} value={url} size={180} level="H" includeMargin={false} />
          </div>
          <Button type="button" size="sm" variant="ghost" onClick={downloadQr}>
            <Download className="h-4 w-4 mr-1" />
            Baixar QR Code
          </Button>
        </div>
      )}
    </div>
  );
}
