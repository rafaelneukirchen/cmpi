import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { NativeSelect } from "@/components/ui/native-select";
import {
  TrendingUp, HelpCircle, Newspaper, Lightbulb, RefreshCw, MapPin,
  ExternalLink, Clock, AlertTriangle, Sparkles, Video, Hash,
  Shield, GraduationCap, Landmark, HeartPulse, Bus, Briefcase, Droplets, Building2, Scale,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type Trend = { title: string; traffic: string | null };
const CATEGORY_COLORS: Record<string, string> = {
  "saúde": "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  "transporte": "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  "segurança": "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  "educação": "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  "saneamento": "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
  "infraestrutura": "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  "emprego": "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  "geral": "bg-muted text-muted-foreground",
};
const CATEGORY_ICONS: Record<string, string> = {
  "saúde": "🏥", "transporte": "🚌", "segurança": "🛡️", "educação": "📚",
  "saneamento": "💧", "infraestrutura": "🏗️", "emprego": "💼", "geral": "📋",
};
type Question = { question: string; snippet: string; category?: string };
type Article = {
  title: string; description: string; url: string;
  source: string; publishedAt: string; image: string | null;
};
type Theme = { titulo: string; justificativa: string; como_abordar: string; hashtags?: string };

const LOCATION_OPTIONS = [
  { value: "Brazil", label: "🇧🇷 Brasil (Nacional)" },
  { value: "São Paulo", label: "📍 São Paulo" },
  { value: "Rio de Janeiro", label: "📍 Rio de Janeiro" },
  { value: "Minas Gerais", label: "📍 Minas Gerais" },
  { value: "Bahia", label: "📍 Bahia" },
  { value: "Paraná", label: "📍 Paraná" },
  { value: "__custom", label: "🔍 Digitar município..." },
];

const AUTO_REFRESH_MS = 30 * 60 * 1000;

const NEWS_CATEGORY_MAP: { keywords: string[]; icon: React.ElementType; bg: string; color: string; label: string }[] = [
  { keywords: ["saúde", "saude", "hospital", "médic", "medic", "ubs", "sus", "vacina", "doença"], icon: HeartPulse, bg: "bg-red-500/10", color: "text-red-500", label: "Saúde" },
  { keywords: ["segurança", "seguranca", "polícia", "policia", "crime", "violência", "preso", "assalto"], icon: Shield, bg: "bg-orange-500/10", color: "text-orange-500", label: "Segurança" },
  { keywords: ["educação", "educacao", "escola", "ensino", "professor", "universidade", "enem"], icon: GraduationCap, bg: "bg-green-500/10", color: "text-green-500", label: "Educação" },
  { keywords: ["transporte", "ônibus", "onibus", "trânsito", "transito", "metrô", "metro", "mobilidade"], icon: Bus, bg: "bg-blue-500/10", color: "text-blue-500", label: "Transporte" },
  { keywords: ["saneamento", "esgoto", "água", "agua", "lixo", "enchente", "alagamento"], icon: Droplets, bg: "bg-cyan-500/10", color: "text-cyan-500", label: "Saneamento" },
  { keywords: ["infraestrutura", "obra", "asfalto", "moradia", "construção", "ponte"], icon: Building2, bg: "bg-yellow-500/10", color: "text-yellow-600", label: "Infraestrutura" },
  { keywords: ["emprego", "trabalho", "desemprego", "salário", "renda", "economia", "pib", "inflação"], icon: Briefcase, bg: "bg-purple-500/10", color: "text-purple-500", label: "Economia" },
  { keywords: ["eleição", "eleicao", "candidat", "voto", "campanha", "partido", "governo", "presidente", "prefeit", "governador", "deputad", "senador", "política", "politica"], icon: Landmark, bg: "bg-indigo-500/10", color: "text-indigo-500", label: "Política" },
  { keywords: ["justiça", "justica", "stf", "tribunal", "lei", "direito", "judiciário"], icon: Scale, bg: "bg-amber-500/10", color: "text-amber-600", label: "Justiça" },
];

function getNewsCategory(title: string, description: string) {
  const text = `${title} ${description}`.toLowerCase();
  for (const cat of NEWS_CATEGORY_MAP) {
    if (cat.keywords.some((k) => text.includes(k))) return cat;
  }
  return { icon: Newspaper, bg: "bg-muted", color: "text-muted-foreground", label: "Geral" };
}

export default function InteligenciaCampanha() {
  const [location, setLocation] = useState("Brazil");
  const [customCity, setCustomCity] = useState("");
  const [useCustom, setUseCustom] = useState(false);

  const [trends, setTrends] = useState<Trend[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [themes, setThemes] = useState<Theme[]>([]);

  const [loadingTrends, setLoadingTrends] = useState(false);
  const [loadingNews, setLoadingNews] = useState(false);
  const [loadingThemes, setLoadingThemes] = useState(false);

  const [trendsError, setTrendsError] = useState<string | null>(null);
  const [newsError, setNewsError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const effectiveLocation = useCustom && customCity.trim() ? customCity.trim() : location;

  const fetchTrends = useCallback(async () => {
    setLoadingTrends(true);
    setTrendsError(null);
    try {
      const { data, error } = await supabase.functions.invoke("getGoogleTrendsData", {
        body: { location: effectiveLocation },
      });
      if (error) throw error;
      if (data?.error) {
        setTrendsError(data.error);
        setTrends([]);
        setQuestions([]);
      } else {
        setTrends(data?.trends || []);
        setQuestions(data?.questions || []);
        // If the trends endpoint also returns news, use those as supplementary
        if (data?.news && data.news.length > 0 && articles.length === 0) {
          setArticles(data.news.map((n: any) => ({
            title: n.title,
            description: n.snippet || "",
            url: n.link || "",
            source: n.source || "",
            publishedAt: n.date || "",
            image: null,
          })));
        }
      }
    } catch (e: any) {
      setTrendsError(e.message);
    } finally {
      setLoadingTrends(false);
    }
  }, [effectiveLocation]);

  const fetchNews = useCallback(async () => {
    setLoadingNews(true);
    setNewsError(null);
    try {
      const { data, error } = await supabase.functions.invoke("getNewsData", {
        body: { location: effectiveLocation },
      });
      if (error) throw error;
      if (data?.error) {
        setNewsError(data.error);
        setArticles([]);
      } else {
        if (data?.articles && data.articles.length > 0) {
          setArticles(data.articles);
        }
      }
    } catch (e: any) {
      setNewsError(e.message);
    } finally {
      setLoadingNews(false);
    }
  }, [effectiveLocation]);

  const fetchAll = useCallback(async () => {
    await Promise.all([fetchTrends(), fetchNews()]);
    setLastUpdated(new Date());
  }, [fetchTrends, fetchNews]);

  const generateThemes = async () => {
    setLoadingThemes(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-campaign-themes", {
        body: { trends, questions, articles, location: effectiveLocation },
      });
      if (error) throw error;
      setThemes(data?.themes || []);
      toast.success("Temas estratégicos gerados!");
    } catch (e: any) {
      toast.error("Erro ao gerar temas: " + e.message);
    } finally {
      setLoadingThemes(false);
    }
  };

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, AUTO_REFRESH_MS);
    return () => clearInterval(interval);
  }, [fetchAll]);

  const MissingKeyAlert = ({ name }: { name: string }) => (
    <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span>
        <strong>{name}</strong> não configurada. Adicione a chave nas configurações para ativar este recurso.
      </span>
    </div>
  );

  const isLoading = loadingTrends || loadingNews;

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Inteligência de Campanha</h1>
          <p className="text-sm text-muted-foreground">
            Monitore tendências, notícias e gere temas estratégicos • Localização: <strong>{effectiveLocation}</strong>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <Badge variant="outline" className="gap-1 text-xs">
              <Clock className="h-3 w-3" />
              {format(lastUpdated, "HH:mm", { locale: ptBR })}
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={fetchAll} disabled={isLoading}>
            <RefreshCw className={`mr-1 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Location Selector */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Localização</label>
            <div className="flex gap-2">
              <NativeSelect
                options={LOCATION_OPTIONS}
                value={useCustom ? "__custom" : location}
                onChange={(e) => {
                  if (e.target.value === "__custom") {
                    setUseCustom(true);
                  } else {
                    setUseCustom(false);
                    setLocation(e.target.value);
                  }
                }}
                className="max-w-[280px]"
              />
              {useCustom && (
                <Input
                  placeholder="Digite o município ou estado..."
                  value={customCity}
                  onChange={(e) => setCustomCity(e.target.value)}
                  className="max-w-[280px]"
                  onKeyDown={(e) => { if (e.key === "Enter" && customCity.trim()) fetchAll(); }}
                />
              )}
            </div>
          </div>
          {useCustom && customCity.trim() && (
            <Button size="sm" onClick={fetchAll} disabled={isLoading}>
              <MapPin className="mr-1 h-4 w-4" /> Buscar
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Main Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Trending Topics */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="h-5 w-5 text-primary" />
              Temas Mais Comentados
            </CardTitle>
            <CardDescription>Trending topics do Google para a região selecionada</CardDescription>
          </CardHeader>
          <CardContent>
            {trendsError && <MissingKeyAlert name="SERPAPI_KEY" />}
            {loadingTrends ? (
              <div className="space-y-2">
                {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
              </div>
            ) : trends.length === 0 && !trendsError ? (
              <div className="text-center py-8 text-muted-foreground">
                <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Nenhuma tendência encontrada para esta região.</p>
                <p className="text-xs mt-1">Tente outra localização ou aguarde a próxima atualização.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                {trends.map((t, i) => (
                  <a
                    key={`trend-${i}-${t.title}`}
                    href={`https://news.google.com/search?q=${encodeURIComponent(t.title)}&hl=pt-BR&gl=BR&ceid=BR:pt-419`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2.5 hover:bg-primary/5 hover:border-primary/40 transition-colors cursor-pointer"
                    title={`Ver notícias sobre "${t.title}"`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                        {i + 1}
                      </span>
                      <span className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">{t.title}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      {t.traffic && (
                        <Badge variant="secondary" className="text-xs">{t.traffic}</Badge>
                      )}
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                  </a>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* City Problems */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <HelpCircle className="h-5 w-5 text-primary" />
              Principais Problemas da Cidade
            </CardTitle>
            <CardDescription>Saúde, transporte, segurança, educação, saneamento e mais — {effectiveLocation}</CardDescription>
          </CardHeader>
          <CardContent>
            {trendsError && <MissingKeyAlert name="SERPAPI_KEY" />}
            {loadingTrends ? (
              <div className="space-y-2">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : questions.length === 0 && !trendsError ? (
              <div className="text-center py-8 text-muted-foreground">
                <HelpCircle className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Nenhum problema identificado para esta região.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                {questions.map((q, i) => (
                  <a
                    key={`q-${i}`}
                    href={`https://news.google.com/search?q=${encodeURIComponent(q.question + " " + effectiveLocation)}&hl=pt-BR&gl=BR&ceid=BR:pt-419`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group block rounded-lg border border-border bg-muted/30 p-3 hover:bg-primary/5 hover:border-primary/40 transition-colors cursor-pointer"
                    title="Buscar notícias relacionadas"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{CATEGORY_ICONS[q.category || "geral"] || "📋"}</span>
                        <Badge className={`text-[10px] px-1.5 py-0 ${CATEGORY_COLORS[q.category || "geral"] || CATEGORY_COLORS.geral}`}>
                          {(q.category || "geral").charAt(0).toUpperCase() + (q.category || "geral").slice(1)}
                        </Badge>
                      </div>
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                    </div>
                    <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">{q.question}</p>
                    {q.snippet && (
                      <p className="mt-1.5 text-xs text-muted-foreground line-clamp-3">{q.snippet}</p>
                    )}
                  </a>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* News Feed */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Newspaper className="h-5 w-5 text-primary" />
            Feed de Notícias Políticas
          </CardTitle>
          <CardDescription>Notícias mais relevantes do dia para a região selecionada</CardDescription>
        </CardHeader>
        <CardContent>
          {newsError && !articles.length && <MissingKeyAlert name="API de Notícias" />}
          {loadingNews && !articles.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-36 w-full rounded-lg" />)}
            </div>
          ) : articles.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Newspaper className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Nenhuma notícia encontrada para esta região.</p>
              <p className="text-xs mt-1">As notícias são buscadas via Google News e News API.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {articles.slice(0, 12).map((a, i) => {
                const cat = getNewsCategory(a.title, a.description);
                const IconComp = cat.icon;
                return (
                  <a
                    key={`article-${i}`}
                    href={a.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex flex-col rounded-xl border border-border bg-card overflow-hidden transition-all hover:shadow-lg hover:border-primary/40 hover:-translate-y-0.5"
                  >
                    <div className="relative h-40 w-full overflow-hidden bg-muted">
                      {a.image ? (
                        <>
                          <img
                            src={a.image}
                            alt={a.title}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                            loading="lazy"
                            onError={(e) => {
                              const img = e.currentTarget;
                              img.style.display = "none";
                              const fb = img.nextElementSibling as HTMLElement | null;
                              if (fb) fb.style.display = "flex";
                            }}
                          />
                          <div
                            className={`absolute inset-0 hidden items-center justify-center gap-2 ${cat.bg}`}
                          >
                            <IconComp className={`h-10 w-10 ${cat.color}`} />
                            <span className={`text-xs font-semibold uppercase tracking-wider ${cat.color}`}>
                              {cat.label}
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className={`flex items-center justify-center gap-2 h-full w-full ${cat.bg}`}>
                          <IconComp className={`h-10 w-10 ${cat.color}`} />
                          <span className={`text-xs font-semibold uppercase tracking-wider ${cat.color}`}>
                            {cat.label}
                          </span>
                        </div>
                      )}
                      <Badge
                        className={`absolute top-2 left-2 text-[10px] font-semibold uppercase tracking-wider border-0 ${cat.bg} ${cat.color} backdrop-blur-sm`}
                      >
                        <IconComp className="h-3 w-3 mr-1" />
                        {cat.label}
                      </Badge>
                    </div>
                    <div className="p-4 flex flex-col flex-1">
                      <h4 className="text-sm font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                        {a.title}
                      </h4>
                      {a.description && a.description.length < 220 && !a.description.startsWith("&") && (
                        <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">{a.description}</p>
                      )}
                      <div className="mt-auto pt-3 flex items-center justify-between">
                        <span className="text-xs text-muted-foreground font-medium truncate max-w-[70%]">{a.source}</span>
                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                      </div>
                      {a.publishedAt && (
                        <p className="mt-1 text-[10px] text-muted-foreground/60">{a.publishedAt}</p>
                      )}
                    </div>
                  </a>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI Theme Generator */}
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-primary" />
            Gerador de Temas para Campanha
          </CardTitle>
          <CardDescription>
            IA analisa tendências, dúvidas e notícias para sugerir temas com dicas de abordagem para redes sociais
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={generateThemes} disabled={loadingThemes} size="lg" className="w-full sm:w-auto">
            {loadingThemes ? (
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Lightbulb className="mr-2 h-4 w-4" />
            )}
            Gerar 3 Temas Estratégicos
          </Button>

          {themes.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-3">
              {themes.map((t, i) => (
                <Card key={`theme-${i}`} className="border-primary/20 shadow-sm">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                        <Video className="h-4 w-4" />
                      </div>
                      <h4 className="text-sm font-bold text-foreground leading-tight">{t.titulo}</h4>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{t.justificativa}</p>
                    {t.como_abordar && (
                      <div className="rounded-lg bg-primary/5 border border-primary/10 p-3 space-y-1">
                        <p className="text-xs font-semibold text-primary flex items-center gap-1">
                          📱 Como abordar:
                        </p>
                        <p className="text-xs text-foreground/80 leading-relaxed">{t.como_abordar}</p>
                      </div>
                    )}
                    {t.hashtags && (
                      <div className="flex items-center gap-1">
                        <Hash className="h-3 w-3 text-primary" />
                        <p className="text-xs text-primary font-medium">{t.hashtags}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        Dados atualizados automaticamente a cada 30 minutos • Fontes: Google Trends, Google News, News API
      </p>
    </div>
  );
}
