import { useEffect, useMemo, useState } from "react";
import { useAppSettings } from "@/hooks/useAppSettings";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Check, ArrowRight, MessageCircle, Sparkles, Loader2 } from "lucide-react";
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
  {
    nome: "Municipal",
    preco: "R$ 497",
    periodo: "/mês",
    descricao: "Ideal para vereadores e candidaturas locais",
    features: ["Até 5 usuários", "1 município", "Mapa eleitoral", "Gestão de lideranças", "Suporte por e-mail"],
  },
  {
    nome: "Estadual",
    preco: "R$ 1.497",
    periodo: "/mês",
    descricao: "Para deputados e campanhas regionais",
    features: ["Usuários ilimitados", "Até 50 municípios", "Tudo do plano Municipal", "Inteligência de campanha", "Radar Social", "Suporte prioritário WhatsApp"],
    destaque: true,
  },
  {
    nome: "Federal",
    preco: "Sob consulta",
    descricao: "Para campanhas estaduais e federais",
    features: ["Estado completo (645 cidades)", "Tudo do plano Estadual", "White-label total", "Onboarding dedicado", "Consultoria estratégica", "SLA 24/7"],
    cta: "Falar com especialista",
  },
];

const DEFAULT_FAQ: Faq[] = [
  { pergunta: "Como funciona a entrega do sistema?", resposta: "Após a confirmação do pagamento, em até 24h você recebe um link próprio do seu sistema, já personalizado com o nome, cor e logo da sua empresa. Basta cadastrar seus usuários e começar a usar." },
  { pergunta: "Os dados ficam isolados de outros clientes?", resposta: "Sim. Cada cliente recebe uma instância completamente isolada, com banco de dados próprio. Nenhum cliente vê os dados de outro." },
  { pergunta: "Posso personalizar a marca do sistema?", resposta: "Sim! Você pode trocar nome, logo, favicon, cor primária e até os textos legais (termos de uso e política de privacidade) direto no painel de configurações." },
  { pergunta: "Tem fidelidade ou multa de cancelamento?", resposta: "Não. Você pode cancelar quando quiser. Apenas pedimos aviso de 30 dias para encerrar a assinatura e exportar seus dados com tranquilidade." },
  { pergunta: "Vocês oferecem suporte e treinamento?", resposta: "Sim. Todos os planos incluem suporte. Os planos Estadual e Federal contam ainda com treinamento da equipe e atendimento prioritário via WhatsApp." },
  { pergunta: "O sistema funciona no celular?", resposta: "Sim. A plataforma é totalmente responsiva e funciona em qualquer dispositivo. Há também versão para Android e iOS via Capacitor." },
];

function safeParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? (parsed as T) : fallback;
  } catch {
    return fallback;
  }
}

export default function Landing() {
  const { data: settings, isLoading } = useAppSettings();
  const [imgError, setImgError] = useState(false);

  const cfg = useMemo(() => {
    const heroTitle = settings?.landing_hero_title || "Inteligência eleitoral com precisão de agulha.";
    const heroSubtitle = settings?.landing_hero_subtitle || "A plataforma white-label definitiva para campanhas que exigem clareza absoluta. Transforme dados dispersos em decisões estratégicas — com a sua marca, do seu jeito.";
    const ctaText = settings?.landing_cta_text || "Solicitar demonstração";
    const whatsapp = (settings?.landing_whatsapp || "").replace(/\D/g, "");
    const whatsappMsg = settings?.landing_whatsapp_msg || "Olá! Tenho interesse no sistema de inteligência eleitoral. Pode me passar mais informações?";
    const demoTitle = settings?.landing_demo_title || "Mapeamento estratégico em tempo real";
    const demoText = settings?.landing_demo_text || "Monitore cidades, lideranças, projeções de votos e operações de campo em uma única plataforma. Decisões mais rápidas, vitórias mais previsíveis.";
    const demoImage = settings?.landing_demo_image || "";
    const featuresTitle = settings?.landing_section_title || "Tudo o que sua campanha precisa";
    const planos = safeParse<Plano[]>(settings?.landing_planos, DEFAULT_PLANOS);
    const faq = safeParse<Faq[]>(settings?.landing_faq, DEFAULT_FAQ);
    const empresa = settings?.app_name || "Inteligência Eleitoral";
    const tagline = settings?.landing_tagline || "Plataforma white-label";
    return { heroTitle, heroSubtitle, ctaText, whatsapp, whatsappMsg, demoTitle, demoText, demoImage, featuresTitle, planos, faq, empresa, tagline };
  }, [settings]);

  const whatsappLink = cfg.whatsapp
    ? `https://wa.me/${cfg.whatsapp}?text=${encodeURIComponent(cfg.whatsappMsg)}`
    : null;

  useEffect(() => {
    document.title = `${cfg.empresa} — ${cfg.tagline}`;
    const meta = document.querySelector('meta[name="description"]');
    const desc = cfg.heroSubtitle.slice(0, 155);
    if (meta) meta.setAttribute("content", desc);
    else {
      const m = document.createElement("meta");
      m.name = "description";
      m.content = desc;
      document.head.appendChild(m);
    }
  }, [cfg.empresa, cfg.tagline, cfg.heroSubtitle]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleCta = () => {
    if (whatsappLink) window.open(whatsappLink, "_blank", "noopener");
  };

  return (
    <div className="min-h-screen bg-background text-foreground antialiased">
      {/* Nav */}
      <nav className="border-b border-border/60 bg-background/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 md:px-12 py-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <span className="font-semibold tracking-tight">{cfg.empresa}</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <a href="#demo" className="hover:text-foreground transition">Recursos</a>
            <a href="#planos" className="hover:text-foreground transition">Planos</a>
            <a href="#faq" className="hover:text-foreground transition">FAQ</a>
            <Link to="/auth" className="text-primary hover:underline">Acessar conta</Link>
          </div>
          <Button onClick={handleCta} size="sm" className="md:hidden" disabled={!whatsappLink}>
            Contato
          </Button>
        </div>
      </nav>

      {/* Hero */}
      <header className="px-6 md:px-12 py-16 md:py-28 max-w-7xl mx-auto">
        <div className="max-w-4xl">
          <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-6 uppercase tracking-wider">
            {cfg.tagline}
          </span>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-semibold tracking-tight leading-[1.05] mb-6">
            {cfg.heroTitle}
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mb-10 leading-relaxed">
            {cfg.heroSubtitle}
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              size="lg"
              onClick={handleCta}
              disabled={!whatsappLink}
              className="text-base h-12 px-8 gap-2"
            >
              <MessageCircle className="h-5 w-5" />
              {cfg.ctaText}
            </Button>
            <Button asChild size="lg" variant="outline" className="text-base h-12 px-8 gap-2">
              <a href="#planos">
                Ver planos <ArrowRight className="h-4 w-4" />
              </a>
            </Button>
          </div>
          {!whatsappLink && (
            <p className="mt-4 text-xs text-muted-foreground">
              ⚠️ Configure o número de WhatsApp em Configurações → Landing Page
            </p>
          )}
        </div>
      </header>

      {/* Demo */}
      <section id="demo" className="px-6 md:px-12 py-16 md:py-24 bg-muted/30 border-y border-border/60">
        <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-12 items-center">
          <div className="order-2 md:order-1">
            <span className="text-xs uppercase tracking-wider text-primary font-medium">Recursos</span>
            <h2 className="text-3xl md:text-4xl font-semibold mt-3 mb-6 tracking-tight">
              {cfg.demoTitle}
            </h2>
            <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
              {cfg.demoText}
            </p>
            <ul className="space-y-3">
              {[
                "Mapa eleitoral interativo com 645 municípios",
                "Gestão de lideranças, dobradinhas e projeções",
                "Inteligência de campanha com IA",
                "Radar Social integrado ao Instagram",
                "Logística completa de materiais e equipe",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm">
                  <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="h-3 w-3 text-primary" />
                  </div>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="order-1 md:order-2">
            <div className="rounded-2xl overflow-hidden border border-border/60 bg-card shadow-2xl shadow-primary/5 aspect-video">
              {cfg.demoImage && !imgError ? (
                <img
                  src={cfg.demoImage}
                  alt={cfg.demoTitle}
                  className="w-full h-full object-cover"
                  onError={() => setImgError(true)}
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-primary/5 to-primary/15 text-muted-foreground gap-3">
                  <Sparkles className="h-12 w-12 text-primary/40" />
                  <p className="text-sm">Adicione uma imagem em Configurações → Landing Page</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Planos */}
      <section id="planos" className="px-6 md:px-12 py-16 md:py-24 max-w-7xl mx-auto">
        <div className="text-center mb-14">
          <span className="text-xs uppercase tracking-wider text-primary font-medium">Investimento</span>
          <h2 className="text-3xl md:text-5xl font-semibold mt-3 tracking-tight">
            {cfg.featuresTitle}
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Escolha o plano que faz sentido pra sua campanha. Sem fidelidade, sem surpresas.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {cfg.planos.map((plano, idx) => (
            <div
              key={idx}
              className={`relative rounded-2xl p-8 flex flex-col ${
                plano.destaque
                  ? "border-2 border-primary bg-primary/5 shadow-lg shadow-primary/10"
                  : "border border-border bg-card"
              }`}
            >
              {plano.destaque && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-primary text-primary-foreground text-xs font-semibold rounded-full">
                  MAIS ESCOLHIDO
                </span>
              )}
              <h3 className="text-xl font-semibold">{plano.nome}</h3>
              {plano.descricao && (
                <p className="text-sm text-muted-foreground mt-2 min-h-[40px]">{plano.descricao}</p>
              )}
              <div className="my-6 flex items-baseline gap-1">
                <span className="text-4xl font-bold tracking-tight">{plano.preco}</span>
                {plano.periodo && (
                  <span className="text-sm text-muted-foreground">{plano.periodo}</span>
                )}
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                {plano.features.map((feat, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>
              <Button
                onClick={handleCta}
                disabled={!whatsappLink}
                variant={plano.destaque ? "default" : "outline"}
                className="w-full"
              >
                {plano.cta || "Quero esse plano"}
              </Button>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="px-6 md:px-12 py-16 md:py-24 bg-muted/30 border-t border-border/60">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-xs uppercase tracking-wider text-primary font-medium">FAQ</span>
            <h2 className="text-3xl md:text-4xl font-semibold mt-3 tracking-tight">
              Perguntas frequentes
            </h2>
          </div>
          <Accordion type="single" collapsible className="space-y-3">
            {cfg.faq.map((item, idx) => (
              <AccordionItem
                key={idx}
                value={`item-${idx}`}
                className="border border-border rounded-xl bg-card px-5"
              >
                <AccordionTrigger className="text-left font-medium hover:no-underline">
                  {item.pergunta}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed">
                  {item.resposta}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* CTA Final */}
      <section className="px-6 md:px-12 py-20 max-w-7xl mx-auto">
        <div className="rounded-3xl bg-primary text-primary-foreground p-10 md:p-16 text-center">
          <h2 className="text-3xl md:text-4xl font-semibold mb-4 tracking-tight">
            Pronto pra ganhar a sua eleição?
          </h2>
          <p className="text-lg opacity-90 max-w-xl mx-auto mb-8">
            Fale com a gente agora e veja o sistema funcionando na prática.
          </p>
          <Button
            size="lg"
            variant="secondary"
            onClick={handleCta}
            disabled={!whatsappLink}
            className="text-base h-12 px-8 gap-2"
          >
            <MessageCircle className="h-5 w-5" />
            {cfg.ctaText}
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/60 py-10 px-6 md:px-12">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} {cfg.empresa}. Todos os direitos reservados.</p>
          <div className="flex gap-6">
            <Link to="/termos" className="hover:text-foreground transition">Termos</Link>
            <Link to="/privacidade" className="hover:text-foreground transition">Privacidade</Link>
            <Link to="/auth" className="hover:text-foreground transition">Acessar conta</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
