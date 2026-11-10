import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Palette, Upload, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useUpdateAppSetting, useUploadAppAsset } from "@/hooks/useAppSettings";

const PRESET_COLORS: { label: string; hsl: string }[] = [
  { label: "Azul Profundo", hsl: "215 70% 28%" },
  { label: "Verde Eleitoral", hsl: "142 72% 29%" },
  { label: "Vermelho Forte", hsl: "0 72% 45%" },
  { label: "Roxo Moderno", hsl: "262 60% 45%" },
  { label: "Laranja Vibrante", hsl: "24 90% 50%" },
  { label: "Teal Corporativo", hsl: "180 60% 30%" },
];

export function IdentidadeVisualSection({ settings }: { settings: Record<string, string | null> | undefined }) {
  const [appName, setAppName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("");
  const [terms, setTerms] = useState("");
  const [privacy, setPrivacy] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);
  const faviconRef = useRef<HTMLInputElement>(null);

  const updateSetting = useUpdateAppSetting();
  const uploadAsset = useUploadAppAsset();

  useEffect(() => {
    setAppName(settings?.app_name || "");
    setPrimaryColor(settings?.primary_color || "");
    setTerms(settings?.terms_of_use || "");
    setPrivacy(settings?.privacy_policy || "");
  }, [settings?.app_name, settings?.primary_color, settings?.terms_of_use, settings?.privacy_policy]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await Promise.all([
        updateSetting.mutateAsync({ key: "app_name", value: appName.trim() || null }),
        updateSetting.mutateAsync({ key: "primary_color", value: primaryColor.trim() || null }),
        updateSetting.mutateAsync({ key: "terms_of_use", value: terms.trim() || null }),
        updateSetting.mutateAsync({ key: "privacy_policy", value: privacy.trim() || null }),
      ]);
      toast.success("Identidade visual salva!");
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const handleFaviconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione apenas arquivos de imagem");
      return;
    }
    setUploadingFavicon(true);
    try {
      const ext = file.name.split(".").pop();
      const url = await uploadAsset.mutateAsync({ file, path: `app_favicon.${ext}` });
      await updateSetting.mutateAsync({ key: "app_favicon", value: url });
      toast.success("Favicon atualizado!");
    } catch (err: any) {
      toast.error(err.message || "Erro no upload");
    } finally {
      setUploadingFavicon(false);
      if (faviconRef.current) faviconRef.current.value = "";
    }
  };

  const handleRemoveFavicon = async () => {
    try {
      await updateSetting.mutateAsync({ key: "app_favicon", value: null });
      toast.success("Favicon removido");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Palette className="h-4 w-4" />
          Identidade Visual & Marca
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Personalize nome, favicon, cor primária e textos legais do sistema. Ideal para white-label.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Nome */}
        <div className="space-y-2">
          <Label>Nome do Sistema</Label>
          <Input
            placeholder="Ex: Inteligência Eleitoral 2026"
            value={appName}
            onChange={(e) => setAppName(e.target.value)}
            maxLength={60}
          />
          <p className="text-xs text-muted-foreground">Aparece na aba do navegador e na barra lateral.</p>
        </div>

        {/* Favicon */}
        <div className="space-y-2">
          <Label>Favicon (ícone do navegador)</Label>
          <div className="flex items-center gap-3">
            {settings?.app_favicon && (
              <img src={settings.app_favicon} alt="Favicon" className="h-10 w-10 rounded border bg-muted/30 p-1" />
            )}
            <input
              ref={faviconRef}
              type="file"
              accept="image/png,image/x-icon,image/svg+xml,image/jpeg"
              className="hidden"
              onChange={handleFaviconUpload}
            />
            <Button variant="outline" size="sm" onClick={() => faviconRef.current?.click()} disabled={uploadingFavicon}>
              {uploadingFavicon ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
              {settings?.app_favicon ? "Trocar" : "Enviar"} favicon
            </Button>
            {settings?.app_favicon && (
              <Button variant="ghost" size="icon" onClick={handleRemoveFavicon}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">Recomendado: PNG quadrado 64x64 ou maior.</p>
        </div>

        {/* Cor primária */}
        <div className="space-y-2">
          <Label>Cor Primária do Sistema</Label>
          <div className="flex flex-wrap gap-2">
            {PRESET_COLORS.map((c) => (
              <button
                key={c.hsl}
                type="button"
                onClick={() => setPrimaryColor(c.hsl)}
                className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs transition-all ${
                  primaryColor === c.hsl ? "ring-2 ring-primary border-primary" : "border-border hover:bg-muted"
                }`}
              >
                <span className="h-4 w-4 rounded-full border" style={{ background: `hsl(${c.hsl})` }} />
                {c.label}
              </button>
            ))}
          </div>
          <Input
            placeholder="HSL personalizado: 215 70% 28%"
            value={primaryColor}
            onChange={(e) => setPrimaryColor(e.target.value)}
            className="font-mono text-xs"
          />
          {primaryColor && (
            <div className="flex items-center gap-2 mt-1">
              <span className="h-6 w-6 rounded border" style={{ background: `hsl(${primaryColor})` }} />
              <span className="text-xs text-muted-foreground">Pré-visualização da cor</span>
            </div>
          )}
        </div>

        {/* Termos */}
        <div className="space-y-2">
          <Label>Termos de Uso</Label>
          <Textarea
            placeholder="Cole ou escreva os termos de uso aqui..."
            value={terms}
            onChange={(e) => setTerms(e.target.value)}
            rows={5}
          />
          <p className="text-xs text-muted-foreground">
            Acessível em <code className="bg-muted px-1 rounded">/termos</code>
          </p>
        </div>

        {/* Privacidade */}
        <div className="space-y-2">
          <Label>Política de Privacidade</Label>
          <Textarea
            placeholder="Cole ou escreva a política de privacidade aqui..."
            value={privacy}
            onChange={(e) => setPrivacy(e.target.value)}
            rows={5}
          />
          <p className="text-xs text-muted-foreground">
            Acessível em <code className="bg-muted px-1 rounded">/privacidade</code>
          </p>
        </div>

        <div className="flex justify-end pt-2 border-t">
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Salvar identidade visual
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
