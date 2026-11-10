import { useAppSettings } from "@/hooks/useAppSettings";
import { Loader2 } from "lucide-react";
import { Link } from "react-router-dom";

export default function Privacidade() {
  const { data: settings, isLoading } = useAppSettings();
  const appName = settings?.app_name || "Sistema";
  const text = settings?.privacy_policy?.trim();

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <Link to="/" className="text-sm text-primary hover:underline">← Voltar</Link>
        <h1 className="text-3xl font-bold mt-4 mb-6">Política de Privacidade — {appName}</h1>
        {isLoading ? (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        ) : text ? (
          <div className="prose prose-sm max-w-none whitespace-pre-wrap text-foreground/90">{text}</div>
        ) : (
          <p className="text-muted-foreground">A política de privacidade ainda não foi configurada.</p>
        )}
      </div>
    </div>
  );
}
