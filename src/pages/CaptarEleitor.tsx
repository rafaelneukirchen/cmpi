import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, MapPin, CheckCircle2, AlertTriangle, UserPlus, Mic } from "lucide-react";
import { toast } from "sonner";
import { VoiceCaptureDialog } from "@/components/VoiceCaptureDialog";
import { CidadePublicaSelect } from "@/components/CidadePublicaSelect";

interface CaptadorInfo {
  nome: string;
  cidade_nome: string | null;
  tipo: "lideranca" | "usuario";
}

export default function CaptarEleitor() {
  const { token = "" } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [info, setInfo] = useState<CaptadorInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  // form
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [cidadesOficiais, setCidadesOficiais] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc("list_cidades_publicas" as never);
      const rows = (data as unknown as { nome: string }[] | null) || [];
      setCidadesOficiais(rows.map((r) => r.nome));
    })();
  }, []);


  // gps
  const [coords, setCoords] = useState<{ lat: number; lng: number; acc: number } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<"idle" | "loading" | "ok" | "denied">("idle");

  // voz
  const [voiceOpen, setVoiceOpen] = useState(false);

  function applyVoiceData(data: {
    nome_completo?: string; telefone?: string; bairro?: string;
    cidade_nome?: string; zona_eleitoral?: string; observacoes?: string;
  }) {
    if (data.nome_completo) setNome(data.nome_completo);
    if (data.telefone) setTelefone(data.telefone);
    if (data.bairro) setBairro(data.bairro);
    if (data.cidade_nome) setCidade(data.cidade_nome);
    if (data.observacoes) setObservacoes(data.observacoes);
  }

  useEffect(() => {
    document.title = "Cadastro de Apoiador — Captação de Leads";
    (async () => {
      const { data, error } = await supabase.rpc("get_captador_publico" as never, { p_token: token } as never);
      const rows = data as unknown as CaptadorInfo[] | null;
      if (error || !rows || rows.length === 0) {
        setError("Link inválido ou expirado. Solicite um novo link à coordenação.");
      } else {
        setInfo(rows[0]);
      }
      setLoading(false);
    })();
  }, [token]);

  function captureLocation() {
    if (!navigator.geolocation) {
      toast.error("Seu dispositivo não suporta GPS.");
      return;
    }
    setGpsStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy });
        setGpsStatus("ok");
        toast.success("Localização capturada!");
      },
      (err) => {
        console.error(err);
        setGpsStatus("denied");
        toast.error("Permissão de localização negada.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) {
      toast.error("Informe o nome do apoiador.");
      return;
    }
    const telDigits = telefone.replace(/\D/g, "");
    if (telDigits.length < 10 || telDigits.length > 11) {
      toast.error("Telefone obrigatório: informe DDD + número (ex: 11999998888).");
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase.rpc("captar_eleitor_publico_v2" as never, {
      p_token: token,
      p_nome_completo: nome.trim(),
      p_telefone: telefone.trim() || null,
      p_bairro: bairro.trim() || null,
      p_cidade_nome: cidade.trim() || null,
      p_zona_eleitoral: null,
      p_latitude: coords?.lat ?? null,
      p_longitude: coords?.lng ?? null,
      p_accuracy: coords?.acc ?? null,
      p_observacoes: observacoes.trim() || null,
    } as never);
    setSubmitting(false);

    if (error) {
      toast.error("Erro ao salvar: " + error.message);
      return;
    }
    const result = data as { success: boolean; error?: string; duplicate?: boolean } | null;
    if (!result?.success) {
      if (result?.duplicate) {
        toast.warning(result.error || "Este apoiador já foi cadastrado anteriormente.", { duration: 5000 });
      } else {
        toast.error(result?.error || "Erro ao salvar.");
      }
      return;
    }
    setSuccess(true);
    toast.success("Apoiador cadastrado com sucesso!");
    // reset form for next capture
    setNome(""); setTelefone(""); setBairro(""); setObservacoes("");
    // keep cidade and coords as-is for batch capture in same area
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-6 w-6 text-destructive" />
              <CardTitle>Link inválido</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="max-w-lg mx-auto space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Cadastro de Apoiador</CardTitle>
            </div>
            <p className="text-sm text-muted-foreground">
              Captação por <span className="font-semibold text-foreground">{info?.nome}</span>
              {" / "}
              <span className="font-semibold text-foreground">Felipe Carmona</span>
              {info?.cidade_nome && <> · {info.cidade_nome}</>}
            </p>
          </CardHeader>
        </Card>

        {success && (
          <Card className="border-primary bg-primary/5">
            <CardContent className="pt-4 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              <p className="text-sm font-medium">Apoiador cadastrado! Pode cadastrar o próximo.</p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="pt-6">
            <Button
              type="button"
              variant="secondary"
              size="lg"
              className="w-full mb-4"
              onClick={() => setVoiceOpen(true)}
            >
              <Mic className="h-5 w-5 mr-2" />
              Preencher por voz (IA)
            </Button>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="nome">Nome completo *</Label>
                <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} required maxLength={200} autoComplete="off" />
              </div>

              <div>
                <Label htmlFor="telefone">Telefone / WhatsApp (DDD + número) *</Label>
                <Input id="telefone" type="tel" inputMode="tel" required value={telefone} onChange={(e) => setTelefone(e.target.value)} maxLength={20} autoComplete="off" placeholder="(11) 99999-9999" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="bairro">Bairro</Label>
                  <Input id="bairro" value={bairro} onChange={(e) => setBairro(e.target.value)} maxLength={100} autoComplete="off" />
                </div>
                <div>
                  <Label htmlFor="cidade">Cidade</Label>
                  <CidadePublicaSelect
                    id="cidade"
                    value={cidade}
                    onChange={setCidade}
                    options={cidadesOficiais}
                    placeholder="Selecione a cidade"
                  />
                </div>


              </div>


              <div>
                <Label htmlFor="obs">Observações</Label>
                <Textarea id="obs" value={observacoes} onChange={(e) => setObservacoes(e.target.value)} maxLength={500} rows={2} />
              </div>

              <div className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-primary" />
                    <span className="font-medium">Localização</span>
                  </div>
                  <Button type="button" size="sm" variant="outline" onClick={captureLocation} disabled={gpsStatus === "loading"}>
                    {gpsStatus === "loading" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : coords ? "Atualizar" : "Capturar GPS"}
                  </Button>
                </div>
                {coords && (
                  <p className="text-xs text-muted-foreground">
                    {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)} (±{Math.round(coords.acc)}m)
                  </p>
                )}
                {gpsStatus === "denied" && (
                  <p className="text-xs text-destructive">Permita acesso à localização para registrar onde o apoiador foi captado.</p>
                )}
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserPlus className="h-4 w-4 mr-2" />}
                Cadastrar apoiador
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Os dados são enviados de forma segura. Apenas a coordenação tem acesso à lista.
        </p>
      </div>

      <VoiceCaptureDialog open={voiceOpen} onOpenChange={setVoiceOpen} onParsed={applyVoiceData} />
    </div>
  );
}
