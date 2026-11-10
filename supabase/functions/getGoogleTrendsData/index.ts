import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function requireAuth(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data, error } = await sb.auth.getUser();
  return !error && !!data?.user;
}


// Simple XML tag content extractor
function extractTag(xml: string, tag: string): string[] {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi");
  const matches: string[] = [];
  let m;
  while ((m = regex.exec(xml)) !== null) {
    matches.push(m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim());
  }
  return matches;
}

// Fetch Google News RSS (FREE, no API key needed)
async function fetchGoogleNewsRSS(query: string, maxResults = 12): Promise<{ title: string; source: string; link: string; date: string; snippet: string; thumbnail: string | null }[]> {
  try {
    const rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=pt-BR&gl=BR&ceid=BR:pt-419`;
    const resp = await fetch(rssUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; NewsBot/1.0)" },
    });
    if (!resp.ok) {
      console.error("Google News RSS error:", resp.status);
      return [];
    }
    const xml = await resp.text();
    const titles = extractTag(xml, "title").slice(1); // skip channel title
    const links = extractTag(xml, "link").slice(1);
    const pubDates = extractTag(xml, "pubDate");
    const descriptions = extractTag(xml, "description").slice(1);
    const sources = extractTag(xml, "source");

    const articles: any[] = [];
    for (let i = 0; i < Math.min(titles.length, maxResults); i++) {
      articles.push({
        title: titles[i] || "—",
        source: sources[i] || "",
        link: links[i] || "",
        date: pubDates[i] || "",
        snippet: (descriptions[i] || "").replace(/<[^>]*>/g, "").substring(0, 200),
        thumbnail: null,
      });
    }
    return articles;
  } catch (e) {
    console.error("Google News RSS fetch error:", e);
    return [];
  }
}

// Fetch Google Trends RSS (FREE)
async function fetchGoogleTrendsRSS(geo = "BR", maxResults = 15): Promise<{ title: string; traffic: string | null }[]> {
  try {
    const rssUrl = `https://trends.google.com/trending/rss?geo=${geo}`;
    const resp = await fetch(rssUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; TrendsBot/1.0)" },
    });
    if (!resp.ok) {
      console.error("Google Trends RSS error:", resp.status);
      return [];
    }
    const xml = await resp.text();
    const titles = extractTag(xml, "title").slice(1); // skip channel title
    const trafficValues = extractTag(xml, "ht:approx_traffic");

    const trends: any[] = [];
    for (let i = 0; i < Math.min(titles.length, maxResults); i++) {
      trends.push({
        title: titles[i] || "—",
        traffic: trafficValues[i] || null,
      });
    }
    return trends;
  } catch (e) {
    console.error("Google Trends RSS fetch error:", e);
    return [];
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (!(await requireAuth(req))) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const SERPAPI_KEY = Deno.env.get("SERPAPI_KEY");

    const body = await req.json().catch(() => ({}));
    const location = body.location || "Brazil";
    const isNational = location === "Brazil";
    console.log("Fetching data for location:", location);

    let trends: { title: string; traffic: string | null }[] = [];
    let questions: { question: string; snippet: string; category?: string }[] = [];
    let news: any[] = [];
    let usedFreeSource = false;

    // ========== 1) TRENDS ==========
    if (SERPAPI_KEY) {
      try {
        const url = new URL("https://serpapi.com/search.json");
        url.searchParams.set("engine", "google");
        url.searchParams.set("q", isNational
          ? "trending topics Brasil hoje"
          : `assuntos mais comentados "${location}" hoje`);
        url.searchParams.set("gl", "br");
        url.searchParams.set("hl", "pt");
        url.searchParams.set("num", "15");
        url.searchParams.set("api_key", SERPAPI_KEY);

        const resp = await fetch(url.toString());
        const data = await resp.json();

        if (data.error) {
          console.error("SerpApi error:", data.error);
        } else {
          const related = data.related_searches || [];
          const organic = data.organic_results || [];

          if (related.length > 0) {
            trends = related.slice(0, 15).map((r: any) => ({
              title: r.query || r.title || "—",
              traffic: null,
            }));
          }
          if (trends.length < 5 && organic.length > 0) {
            const extra = organic.slice(0, 15 - trends.length).map((r: any) => ({
              title: r.title || "—",
              traffic: r.source || null,
            }));
            trends = [...trends, ...extra];
          }
        }
      } catch (e) {
        console.error("SerpApi trends error:", e);
      }
    }

    // FREE FALLBACK: Google Trends RSS
    if (trends.length === 0) {
      console.log("Using free Google Trends RSS fallback");
      trends = await fetchGoogleTrendsRSS("BR", 15);
      usedFreeSource = true;
    }
    console.log("Trends collected:", trends.length);

    // ========== 2) PROBLEMS/QUESTIONS ==========
    const CATEGORIES = ["saúde", "transporte", "segurança", "educação", "saneamento básico", "infraestrutura", "emprego"];
    const categorize = (text: string) => {
      const t = text.toLowerCase();
      if (t.includes("saúde") || t.includes("saude") || t.includes("hospital") || t.includes("ubs") || t.includes("médic")) return "saúde";
      if (t.includes("transporte") || t.includes("ônibus") || t.includes("trânsito") || t.includes("mobilidade")) return "transporte";
      if (t.includes("segurança") || t.includes("seguranca") || t.includes("violência") || t.includes("crime") || t.includes("polícia")) return "segurança";
      if (t.includes("educação") || t.includes("educacao") || t.includes("escola") || t.includes("ensino")) return "educação";
      if (t.includes("saneamento") || t.includes("esgoto") || t.includes("água") || t.includes("lixo")) return "saneamento";
      if (t.includes("emprego") || t.includes("trabalho") || t.includes("desemprego") || t.includes("renda")) return "emprego";
      if (t.includes("infraestrutura") || t.includes("asfalto") || t.includes("obra") || t.includes("moradia")) return "infraestrutura";
      return "geral";
    };

    if (SERPAPI_KEY) {
      try {
        const mainQuery = isNational
          ? "maiores problemas do Brasil saúde transporte segurança educação saneamento"
          : `maiores problemas "${location}" saúde transporte segurança educação saneamento`;

        const qUrl = new URL("https://serpapi.com/search.json");
        qUrl.searchParams.set("engine", "google");
        qUrl.searchParams.set("q", mainQuery);
        qUrl.searchParams.set("gl", "br");
        qUrl.searchParams.set("hl", "pt");
        qUrl.searchParams.set("num", "10");
        qUrl.searchParams.set("api_key", SERPAPI_KEY);

        const qResp = await fetch(qUrl.toString());
        const qData = await qResp.json();

        if (!qData.error) {
          const rawQuestions = qData.related_questions || qData.people_also_ask || [];
          const organicResults = qData.organic_results || [];

          questions = rawQuestions.slice(0, 8).map((q: any) => ({
            question: q.question || q.title || "—",
            snippet: q.snippet || "",
            category: categorize(q.question || q.title || ""),
          }));

          if (questions.length < 6 && organicResults.length > 0) {
            const organic = organicResults.slice(0, 8).map((r: any) => ({
              question: r.title || "—",
              snippet: r.snippet || "",
              category: categorize(r.title || ""),
            }));
            questions = [...questions, ...organic].slice(0, 12);
          }
        }
      } catch (e) {
        console.error("SerpApi problems error:", e);
      }
    }

    // FREE FALLBACK: Use Google News RSS for problems by category
    if (questions.length < 3) {
      console.log("Using free Google News RSS for problems fallback");
      for (const cat of CATEGORIES) {
        const query = isNational
          ? `problemas ${cat} Brasil`
          : `problemas ${cat} ${location}`;
        const articles = await fetchGoogleNewsRSS(query, 2);
        for (const a of articles) {
          questions.push({
            question: a.title,
            snippet: a.snippet || a.source || "",
            category: cat === "saneamento básico" ? "saneamento" : cat,
          });
        }
        if (questions.length >= 12) break;
      }
      questions = questions.slice(0, 12);
      usedFreeSource = true;
    }
    console.log(`Problems collected: ${questions.length}`);

    // ========== 3) NEWS ==========
    if (SERPAPI_KEY) {
      try {
        const newsUrl = new URL("https://serpapi.com/search.json");
        newsUrl.searchParams.set("engine", "google_news");
        newsUrl.searchParams.set("q", isNational
          ? "política eleições governo"
          : `"${location}" política`);
        newsUrl.searchParams.set("gl", "br");
        newsUrl.searchParams.set("hl", "pt");
        newsUrl.searchParams.set("api_key", SERPAPI_KEY);

        const newsResp = await fetch(newsUrl.toString());
        const newsData = await newsResp.json();

        if (!newsData.error) {
          news = (newsData.news_results || []).slice(0, 12).map((n: any) => ({
            title: n.title || "—",
            source: n.source?.name || n.source || "",
            link: n.link || "",
            date: n.date || "",
            snippet: n.snippet || "",
            thumbnail: n.thumbnail || null,
          }));
        }
      } catch (e) {
        console.error("SerpApi news error:", e);
      }
    }

    // FREE FALLBACK: Google News RSS
    if (news.length === 0) {
      console.log("Using free Google News RSS for news fallback");
      const newsQuery = isNational
        ? "política eleições governo Brasil"
        : `${location} política notícias`;
      news = await fetchGoogleNewsRSS(newsQuery, 12);
      usedFreeSource = true;
    }

    console.log(`Returning: ${trends.length} trends, ${questions.length} questions, ${news.length} news (free=${usedFreeSource})`);

    return new Response(
      JSON.stringify({ trends, questions, news }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Main error:", err);
    return new Response(
      JSON.stringify({ error: String(err), trends: [], questions: [], news: [] }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
