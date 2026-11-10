import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Megaphone, Loader2, Upload, Trash2, ExternalLink, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { useUpdateAppSetting, useUploadAppAsset } from "@/hooks/useAppSettings";
import { Link } from "react-router-dom";

interface Plano {
  nome: string;
  preco: string;
  periodo?: string;
  descricao?: string;
  features: string[];
  destaque?: boolean;
  cta?: string;
}
interface Faq {
  pergunta: string;
  resposta: string;
}

const DEFAULT_PLANOS: Plano[] = [
  { nome: "Municipal", preco: "R$ 497", periodo: "/mês", descricao: "Ideal para vereadores e candidaturas locais", features: ["Até 5 usuários", "1 município", "Mapa eleitoral", "Gestão de lideranças", "Suporte por e-mail"] },
  { nome: "Estadual", preco: "R$ 1.497", periodo: "/mês", descricao: "Para deputados e campanhas regionais", features: ["Usuários ilimitados", "Até 50 municípios", "Tudo do plano Municipal", "Inteligência de campanha", "Radar Social", "Suporte prioritário WhatsApp"], destaque: true },
  { nome: "Federal", preco: "Sob consulta", descricao: "Para campanhas estaduais e federais", features: ["Estado completo (645 cidades)", "Tudo do plano Estadual", "White-label total", "Onboarding dedicado", "Consultoria estratégica", "SLA 24/7"], cta: "Falar com especialista" },
];
const DEFAULT_FAQ: Faq[] = [
  { pergunta: "Como funciona a entrega do sistema?", resposta: "Após a confirmação do pagamento, em até 24h você recebe um link próprio do seu sistema, já personalizado." },
  { pergunta: "Os dados ficam isolados de outros clientes?", resposta: "Sim. Cada cliente recebe uma instância completamente isolada, com banco de dados próprio." },
  { pergunta: "Tem fidelidade ou multa de cancelamento?", resposta: "Não. Você pode cancelar quando quiser." },
];

function safeParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    const p = JSON.parse(raw);
    return Array.isArray(p) ? (p as T) : fallback;
  } catch {
    return fallback;
  }
}

export function LandingPageSection({ settings }: { settings: Record<string, string | null> | undefined }) {
  const [tagline, setTagline] = useState("");
  const [heroTitle, setHeroTitle] = useState("");
  const [heroSubtitle, setHeroSubtitle] = useState("");
  const [ctaText, setCtaText] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [whatsappMsg, setWhatsappMsg] = useState("");
  const [demoTitle, setDemoTitle] = useState("");
  const [demoText, setDemoText] = useState("");
  const [sectionTitle, setSectionTitle] = useState("");
  const [planos, setPlanos] = useState<Plano[]>(DEFAULT_PLANOS);
  const [faq, setFaq] = useState<Faq[]>(DEFAULT_FAQ);

  const [saving, setSaving] = useState(false);
  const [uploadingDemo, setUploadingDemo] = useState(false);
  const demoRef = useRef<HTMLInputElement>(null);

  const updateSetting = useUpdateAppSetting();
  const uploadAsset = useUploadAppAsset();

  useEffect(() => {
    setTagline(settings?.landing_tagline || "");
    setHeroTitle(settings?.landing_hero_title || "");
    setHeroSubtitle(settings?.landing_hero_subtitle || "");
    setCtaText(settings?.landing_cta_text || "");
    setWhatsapp(settings?.landing_whatsapp || "");
    setWhatsappMsg(settings?.landing_whatsapp_msg || "");
    setDemoTitle(settings?.landing_demo_title || "");
    setDemoText(settings?.landing_demo_text || "");
    setSectionTitle(settings?.landing_section_title || "");
    setPlanos(safeParse<Plano[]>(settings?.landing_planos, DEFAULT_PLANOS));
    setFaq(safeParse<Faq[]>(settings?.landing_faq, DEFAULT_FAQ));
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await Promise.all([
        updateSetting.mutateAsync({ key: "landing_tagline", value: tagline.trim() || null }),
        updateSetting.mutateAsync({ key: "landing_hero_title", value: heroTitle.trim() || null }),
        updateSetting.mutateAsync({ key: "landing_hero_subtitle", value: heroSubtitle.trim() || null }),
        updateSetting.mutateAsync({ key: "landing_cta_text", value: ctaText.trim() || null }),
        updateSetting.mutateAsync({ key: "landing_whatsapp", value: whatsapp.replace(/\D/g, "") || null }),
        updateSetting.mutateAsync({ key: "landing_whatsapp_msg", value: whatsappMsg.trim() || null }),
        updateSetting.mutateAsync({ key: "landing_demo_title", value: demoTitle.trim() || null }),
        updateSetting.mutateAsync({ key: "landing_demo_text", value: demoText.trim() || null }),
        updateSetting.mutateAsync({ key: "landing_section_title", value: sectionTitle.trim() || null }),
        updateSetting.mutateAsync({ key: "landing_planos", value: JSON.stringify(planos) }),
        updateSetting.mutateAsync({ key: "landing_faq", value: JSON.stringify(faq) }),
      ]);
      toast.success("Landing page atualizada!");
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const handleDemoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione apenas imagens");
      return;
    }
    setUploadingDemo(true);
    try {
      const ext = file.name.split(".").pop();
      const url = await uploadAsset.mutateAsync({ file, path: `landing_demo.${ext}?t=${Date.now()}` });
      await updateSetting.mutateAsync({ key: "landing_demo_image", value: url });
      toast.success("Imagem da landing atualizada!");
    } catch (err: any) {
      toast.error(err.message || "Erro no upload");
    } finally {
      setUploadingDemo(false);
      if (demoRef.current) demoRef.current.value = "";
    }
  };

  const handleRemoveDemo = async () => {
    try {
      await updateSetting.mutateAsync({ key: "landing_demo_image", value: null });
      toast.success("Imagem removida");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const updatePlano = (idx: number, patch: Partial<Plano>) => {
    setPlanos(planos.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  };
  const updatePlanoFeature = (planoIdx: number, featIdx: number, value: string) => {
    setPlanos(planos.map((p, i) => i === planoIdx ? { ...p, features: p.features.map((f, j) => j === featIdx ? value : f) } : p));
  };
  const addPlanoFeature = (idx: number) => {
    setPlanos(planos.map((p, i) => i === idx ? { ...p, features: [...p.features, "Nova característica"] } : p));
  };
  const removePlanoFeature = (planoIdx: number, featIdx: number) => {
    setPlanos(planos.map((p, i) => i === planoIdx ? { ...p, features: p.features.filter((_, j) => j !== featIdx) } : p));
  };
  const addPlano = () => setPlanos([...planos, { nome: "Novo plano", preco: "R$ 0", periodo: "/mês", features: ["Característica 1"] }]);
  const removePlano = (idx: number) => setPlanos(planos.filter((_, i) => i !== idx));

  const updateFaq = (idx: number, patch: Partial<Faq>) => setFaq(faq.map((f, i) => i === idx ? { ...f, ...patch } : f));
  const addFaq = () => setFaq([...faq, { pergunta: "Nova pergunta?", resposta: "Resposta aqui." }]);
  const removeFaq = (idx: number) => setFaq(faq.filter((_, i) => i !== idx));

  const demoUrl = settings?.landing_demo_image;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Megaphone className="h-4 w-4" />
            Landing Page de Vendas
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Personalize a página pública usada para vender o sistema. Acessível em{" "}
            <Link to="/landing" target="_blank" className="text-primary inline-flex items-center gap-1 hover:underline">
              /landing <ExternalLink className="h-3 w-3" />
            </Link>
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Hero */}
          <div className="space-y-4">
            <h3 className="font-medium text-sm uppercase tracking-wider text-muted-foreground">Hero (topo)</h3>
            <div className="space-y-2">
              <Label>Etiqueta superior</Label>
              <Input value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="Plataforma white-label" maxLength={50} />
            </div>
            <div className="space-y-2">
              <Label>Título principal</Label>
              <Textarea value={heroTitle} onChange={(e) => setHeroTitle(e.target.value)} placeholder="Inteligência eleitoral com precisão de agulha." rows={2} maxLength={120} />
            </div>
            <div className="space-y-2">
              <Label>Subtítulo / descrição</Label>
              <Textarea value={heroSubtitle} onChange={(e) => setHeroSubtitle(e.target.value)} placeholder="Descreva sua proposta de valor..." rows={3} maxLength={300} />
            </div>
            <div className="space-y-2">
              <Label>Texto do botão (CTA)</Label>
              <Input value={ctaText} onChange={(e) => setCtaText(e.target.value)} placeholder="Solicitar demonstração" maxLength={40} />
            </div>
          </div>

          {/* WhatsApp */}
          <div className="space-y-4 pt-4 border-t">
            <h3 className="font-medium text-sm uppercase tracking-wider text-muted-foreground">Botão de Contato (WhatsApp)</h3>
            <div className="space-y-2">
              <Label>Número de WhatsApp (com DDD e código do país)</Label>
              <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="5511999999999" />
              <p className="text-xs text-muted-foreground">Apenas números. Ex.: 5511999999999 (Brasil + DDD + número)</p>
            </div>
            <div className="space-y-2">
              <Label>Mensagem pré-preenchida</Label>
              <Textarea value={whatsappMsg} onChange={(e) => setWhatsappMsg(e.target.value)} placeholder="Olá! Tenho interesse no sistema..." rows={2} maxLength={300} />
            </div>
          </div>

          {/* Demo */}
          <div className="space-y-4 pt-4 border-t">
            <h3 className="font-medium text-sm uppercase tracking-wider text-muted-foreground">Seção de Demonstração</h3>
            <div className="space-y-2">
              <Label>Título</Label>
              <Input value={demoTitle} onChange={(e) => setDemoTitle(e.target.value)} placeholder="Mapeamento estratégico em tempo real" maxLength={80} />
            </div>
            <div className="space-y-2">
              <Label>Texto descritivo</Label>
              <Textarea value={demoText} onChange={(e) => setDemoText(e.target.value)} rows={3} maxLength={400} />
            </div>
            <div className="space-y-2">
              <Label>Imagem (screenshot do sistema, mockup, foto)</Label>
              <div className="flex items-center gap-3 flex-wrap">
                {demoUrl && (
                  <img src={demoUrl} alt="Demo" className="h-20 w-32 object-cover rounded border bg-muted/30" />
                )}
                <input ref={demoRef} type="file" accept="image/*" className="hidden" onChange={handleDemoUpload} />
                <Button variant="outline" size="sm" onClick={() => demoRef.current?.click()} disabled={uploadingDemo}>
                  {uploadingDemo ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                  {demoUrl ? "Trocar" : "Enviar"} imagem
                </Button>
                {demoUrl && (
                  <Button variant="ghost" size="icon" onClick={handleRemoveDemo}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Recomendado: 1200×675px (proporção 16:9)</p>
            </div>
          </div>

          {/* Planos */}
          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-sm uppercase tracking-wider text-muted-foreground">Planos</h3>
              <Button variant="outline" size="sm" onClick={addPlano} className="gap-1">
                <Plus className="h-3 w-3" /> Adicionar plano
              </Button>
            </div>
            <div className="space-y-2">
              <Label>Título da seção de planos</Label>
              <Input value={sectionTitle} onChange={(e) => setSectionTitle(e.target.value)} placeholder="Tudo o que sua campanha precisa" maxLength={80} />
            </div>
            {planos.map((plano, idx) => (
              <div key={idx} className="rounded-lg border p-4 space-y-3 bg-muted/20">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Plano #{idx + 1}</span>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                      <input type="checkbox" checked={!!plano.destaque} onChange={(e) => updatePlano(idx, { destaque: e.target.checked })} />
                      Destacar
                    </label>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removePlano(idx)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="Nome do plano" value={plano.nome} onChange={(e) => updatePlano(idx, { nome: e.target.value })} />
                  <Input placeholder="Preço (R$ 497 ou Sob consulta)" value={plano.preco} onChange={(e) => updatePlano(idx, { preco: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="Período (/mês)" value={plano.periodo || ""} onChange={(e) => updatePlano(idx, { periodo: e.target.value })} />
                  <Input placeholder="Texto do botão (opcional)" value={plano.cta || ""} onChange={(e) => updatePlano(idx, { cta: e.target.value })} />
                </div>
                <Input placeholder="Descrição curta" value={plano.descricao || ""} onChange={(e) => updatePlano(idx, { descricao: e.target.value })} />
                <div className="space-y-2">
                  <Label className="text-xs">Características</Label>
                  {plano.features.map((feat, fIdx) => (
                    <div key={fIdx} className="flex gap-2">
                      <Input value={feat} onChange={(e) => updatePlanoFeature(idx, fIdx, e.target.value)} className="text-sm" />
                      <Button variant="ghost" size="icon" className="h-9 w-9 flex-shrink-0" onClick={() => removePlanoFeature(idx, fIdx)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => addPlanoFeature(idx)} className="gap-1 text-xs">
                    <Plus className="h-3 w-3" /> Adicionar característica
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* FAQ */}
          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-sm uppercase tracking-wider text-muted-foreground">FAQ</h3>
              <Button variant="outline" size="sm" onClick={addFaq} className="gap-1">
                <Plus className="h-3 w-3" /> Adicionar pergunta
              </Button>
            </div>
            {faq.map((item, idx) => (
              <div key={idx} className="rounded-lg border p-4 space-y-3 bg-muted/20">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Pergunta #{idx + 1}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeFaq(idx)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
                <Input placeholder="Pergunta" value={item.pergunta} onChange={(e) => updateFaq(idx, { pergunta: e.target.value })} />
                <Textarea placeholder="Resposta" value={item.resposta} onChange={(e) => updateFaq(idx, { resposta: e.target.value })} rows={2} />
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-4 border-t">
            <Button variant="outline" asChild>
              <Link to="/landing" target="_blank" className="gap-2">
                <ExternalLink className="h-4 w-4" /> Ver landing page
              </Link>
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar landing page
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
