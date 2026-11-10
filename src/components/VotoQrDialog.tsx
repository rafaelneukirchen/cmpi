import { useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Vote, Copy, Download, Share2, UserPlus } from "lucide-react";
import { toast } from "sonner";

interface VotoQrDialogProps {
  token: string | null | undefined;
  nome: string;
  /** Botão customizado opcional. Default: botão "VOTO" verde compacto. */
  trigger?: React.ReactNode;
}

/**
 * Botão "VOTO" que abre um modal com QR Code grande para o apoiador escanear
 * e se cadastrar imediatamente em campo. Funciona tanto para tokens de
 * liderança quanto de usuário (a rota /captar/:token aceita ambos).
 */
export function VotoQrDialog({ token, nome, trigger }: VotoQrDialogProps) {
  const [open, setOpen] = useState(false);

  if (!token) return null;

  // Domínio público de captação. O preview do sandbox (lovableproject.com /
  // id-preview--*.lovable.app) exige login do Lovable e NÃO deve ser usado
  // no QR Code do eleitor — sempre apontamos para o domínio publicado.
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
    const msg = encodeURIComponent(`Cadastre-se como apoiador de ${nome}: ${url}`);
    window.open(`https://wa.me/?text=${msg}`, "_blank");
  }

  function downloadQr() {
    const canvas = document.getElementById(`voto-qr-${token}`) as HTMLCanvasElement | null;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `voto-${nome.replace(/\s+/g, "_")}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button
            size="sm"
            variant="default"
            className="h-8 font-bold"
            title="Gerar QR para captar apoiador"
          >
            <Vote className="h-3.5 w-3.5 mr-1" />
            VOTO
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Vote className="h-5 w-5 text-primary" />
            Captação de Lead
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Captação por</p>
            <p className="font-semibold">{nome}</p>
          </div>

          <div className="flex justify-center">
            <div className="bg-white p-4 rounded-lg border">
              <QRCodeCanvas id={`voto-qr-${token}`} value={url} size={260} level="H" includeMargin={false} />
            </div>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            Mostre este QR Code para o apoiador escanear com a câmera do celular.
            <br />
            Ao escanear, ele preenche os dados e sai cadastrado no sistema.
          </p>

          <div className="flex gap-2">
            <Input value={url} readOnly className="font-mono text-xs" onFocus={(e) => e.target.select()} />
            <Button type="button" size="icon" variant="outline" onClick={copy} title="Copiar link">
              <Copy className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={shareWhatsapp}>
              <Share2 className="h-4 w-4 mr-2" />
              WhatsApp
            </Button>
            <Button type="button" variant="outline" className="flex-1" onClick={downloadQr}>
              <Download className="h-4 w-4 mr-2" />
              Baixar QR
            </Button>
          </div>

          <Button
            type="button"
            variant="default"
            className="w-full"
            onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Cadastrar manualmente (sem QR)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
