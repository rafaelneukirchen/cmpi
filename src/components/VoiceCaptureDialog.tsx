import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Mic, MicOff, Loader2, Sparkles, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

// Tipagem mínima para Web Speech API (não vem no lib.dom padrão)
interface ISpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((this: ISpeechRecognition, ev: any) => void) | null;
  onerror: ((this: ISpeechRecognition, ev: any) => void) | null;
  onend: ((this: ISpeechRecognition, ev: any) => void) | null;
}

interface ParsedEleitor {
  nome_completo?: string;
  telefone?: string;
  bairro?: string;
  cidade_nome?: string;
  zona_eleitoral?: string;
  observacoes?: string;
}

interface VoiceCaptureDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onParsed: (data: ParsedEleitor) => void;
}

export function VoiceCaptureDialog({ open, onOpenChange, onParsed }: VoiceCaptureDialogProps) {
  const [supported, setSupported] = useState(true);
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [processing, setProcessing] = useState(false);
  const recRef = useRef<ISpeechRecognition | null>(null);

  useEffect(() => {
    const SR =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setSupported(false);
      return;
    }
    const rec: ISpeechRecognition = new SR();
    rec.lang = "pt-BR";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (ev: any) => {
      let finalText = "";
      let interimText = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const res = ev.results[i];
        if (res.isFinal) finalText += res[0].transcript + " ";
        else interimText += res[0].transcript;
      }
      if (finalText) setTranscript((prev) => (prev + " " + finalText).trim());
      setInterim(interimText);
    };
    rec.onerror = (ev: any) => {
      console.error("SpeechRecognition error", ev);
      if (ev.error === "not-allowed" || ev.error === "service-not-allowed") {
        toast.error("Permissão de microfone negada.");
      } else if (ev.error === "no-speech") {
        toast.message("Nenhuma fala detectada.");
      }
      setRecording(false);
    };
    rec.onend = () => setRecording(false);
    recRef.current = rec;
    return () => {
      try { rec.abort(); } catch {}
    };
  }, []);

  // Reset ao abrir
  useEffect(() => {
    if (open) {
      setTranscript("");
      setInterim("");
      setProcessing(false);
    } else {
      try { recRef.current?.abort(); } catch {}
      setRecording(false);
    }
  }, [open]);

  function toggleRecord() {
    if (!recRef.current) return;
    if (recording) {
      try { recRef.current.stop(); } catch {}
      setRecording(false);
    } else {
      setInterim("");
      try {
        recRef.current.start();
        setRecording(true);
      } catch (e) {
        console.error(e);
        toast.error("Não foi possível iniciar o microfone.");
      }
    }
  }

  async function handleProcess() {
    const txt = (transcript + " " + interim).trim();
    if (!txt) {
      toast.error("Grave algo antes de processar.");
      return;
    }
    setProcessing(true);
    try {
      if (recording) {
        try { recRef.current?.stop(); } catch {}
        setRecording(false);
      }
      const { data, error } = await supabase.functions.invoke("parse-eleitor-voice", {
        body: { transcript: txt },
      });
      if (error) throw error;
      const result = data as { success: boolean; data?: ParsedEleitor; error?: string };
      if (!result?.success) {
        toast.error(result?.error || "Não foi possível interpretar a fala.");
        return;
      }
      onParsed(result.data || {});
      toast.success("Dados preenchidos! Revise antes de salvar.");
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao processar a fala.");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Cadastro por Voz
          </DialogTitle>
        </DialogHeader>

        {!supported ? (
          <div className="space-y-3 py-2">
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <p className="text-sm">
                Seu navegador não suporta reconhecimento de voz. Use o Chrome no
                Android ou o Safari no iPhone (iOS 14.5+).
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <p className="font-medium mb-1">💡 Como usar</p>
              <p className="text-muted-foreground text-xs leading-relaxed">
                Toque no microfone e pergunte: <em>"Qual seu nome completo? Telefone?
                Bairro? Cidade? Zona eleitoral?"</em> A IA preenche o formulário sozinha.
              </p>
            </div>

            <div className="flex justify-center">
              <Button
                type="button"
                size="lg"
                variant={recording ? "destructive" : "default"}
                onClick={toggleRecord}
                disabled={processing}
                className="h-20 w-20 rounded-full"
              >
                {recording ? <MicOff className="h-8 w-8" /> : <Mic className="h-8 w-8" />}
              </Button>
            </div>
            <p className="text-center text-xs text-muted-foreground -mt-2">
              {recording ? "Gravando… toque para parar" : "Toque para começar"}
            </p>

            <div className="rounded-md border p-3 min-h-[100px] text-sm whitespace-pre-wrap">
              {transcript || interim ? (
                <>
                  <span>{transcript}</span>
                  <span className="text-muted-foreground italic"> {interim}</span>
                </>
              ) : (
                <span className="text-muted-foreground">A transcrição aparecerá aqui…</span>
              )}
            </div>

            <Button
              type="button"
              className="w-full"
              size="lg"
              onClick={handleProcess}
              disabled={processing || (!transcript.trim() && !interim.trim())}
            >
              {processing ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processando…</>
              ) : (
                <><Sparkles className="h-4 w-4 mr-2" /> Preencher formulário com IA</>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
