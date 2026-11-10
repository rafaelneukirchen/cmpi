import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Download, ImagePlus, Loader2, Sparkles, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCanUseSantinho } from "@/hooks/useUserPermissions";
import templateAsset from "@/assets/santinho-template.jpeg.asset.json";
import candidatoAsset from "@/assets/felipe-carmona.jpeg.asset.json";

async function urlToDataUrl(src: string): Promise<string> {
  const res = await fetch(src);
  if (!res.ok) throw new Error("Falha ao carregar imagem");
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function Santinho() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [userPhoto, setUserPhoto] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const canUse = useCanUseSantinho();

  const handleFile = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Envie um arquivo de imagem (JPG ou PNG).");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("A foto deve ter no máximo 8 MB.");
      return;
    }
    setUserPhoto(await fileToDataUrl(file));
    setResult(null);
  };

  const gerar = async () => {
    if (!userPhoto) {
      toast.error("Envie a sua foto primeiro.");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const [templateImage, candidatoImage] = await Promise.all([
        urlToDataUrl(templateAsset.url),
        urlToDataUrl(candidatoAsset.url),
      ]);

      const { data, error } = await supabase.functions.invoke("gerar-santinho", {
        body: { templateImage, candidatoImage, userImage: userPhoto },
      });

      if (error) throw new Error(error.message);
      if (!data?.success || !data?.image) {
        throw new Error(data?.error || "Não foi possível gerar o santinho.");
      }

      setResult(data.image);
      toast.success("Santinho pronto! Agora é só baixar e compartilhar.");
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Falha ao gerar o santinho. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const baixar = async () => {
    if (!result) return;
    try {
      const res = await fetch(result);
      const blob = await res.blob();
      const file = new File([blob], "santinho-felipe-carmona.png", { type: blob.type || "image/png" });

      const nav = navigator as Navigator & { canShare?: (d: any) => boolean };
      if (nav.share && nav.canShare?.({ files: [file] })) {
        await nav.share({ files: [file], title: "Meu Santinho" });
        return;
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "santinho-felipe-carmona.png";
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast.success("Imagem salva nos downloads do seu aparelho.");
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      console.error(e);
      toast.error("Não foi possível baixar. Toque e segure na imagem para salvar na galeria.");
    }
  };

  if (!canUse) {
    return (
      <div className="max-w-lg mx-auto mt-10">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" /> Meu Santinho
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Você ainda não tem acesso a esta ferramenta. Peça ao administrador para liberar a
            permissão "Meu Santinho" no seu cadastro.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" /> Meu Santinho
        </h1>
        <p className="text-muted-foreground text-sm">
          Envie a sua foto e receba um santinho personalizado ao lado do Felipe Carmona para baixar e compartilhar.
          A imagem não fica salva no sistema.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">1. Envie a sua foto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="w-full aspect-[3/4] rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 overflow-hidden hover:border-primary transition-colors"
            >
              {userPhoto ? (
                <img src={userPhoto} alt="Sua foto" className="h-full w-full object-cover" />
              ) : (
                <>
                  <ImagePlus className="h-10 w-10 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Toque para escolher ou tirar uma foto</span>
                </>
              )}
            </button>
            <div className="flex gap-2">
              <Button onClick={gerar} disabled={!userPhoto || loading} className="flex-1">
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Gerando...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" /> Gerar santinho
                  </>
                )}
              </Button>
              {userPhoto && (
                <Button variant="outline" onClick={() => inputRef.current?.click()} disabled={loading}>
                  <RefreshCw className="h-4 w-4" /> Trocar
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              A montagem é feita com inteligência artificial e pode levar alguns segundos. Use uma foto nítida, de frente e com o rosto bem visível.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">2. Baixe e compartilhe</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="w-full aspect-[3/4] rounded-lg border bg-muted/30 overflow-hidden flex items-center justify-center">
              {loading ? (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <span className="text-sm">Gerando o seu santinho com IA...</span>
                </div>
              ) : (
                <img
                  src={result ?? templateAsset.url}
                  alt={result ? "Seu santinho personalizado" : "Modelo do santinho"}
                  className="h-full w-full object-contain"
                />
              )}
            </div>
            <Button onClick={baixar} disabled={!result} className="w-full">
              <Download className="h-4 w-4" /> Baixar santinho
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
