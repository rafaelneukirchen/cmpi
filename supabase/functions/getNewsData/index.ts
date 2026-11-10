import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

// Extract first image URL from HTML description
function extractImageFromHtml(html: string): string | null {
  if (!html) return null;
  const imgMatch = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (imgMatch) return imgMatch[1];
  const mediaMatch = html.match(/<media:content[^>]+url=["']([^"']+)["']/i);
  if (mediaMatch) return mediaMatch[1];
  const enclosureMatch = html.match(/<enclosure[^>]+url=["']([^"']+)["']/i);
  if (enclosureMatch) return enclosureMatch[1];
  return null;
}

// Resolve Google News redirect to the real article URL via the public proxy
async function resolveGoogleNewsUrl(url: string): Promise<string> {
  if (!url.includes("news.google.com")) return url;
  try {
    // Use a public CORS-free redirect resolver
    const resolverUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 7000);
    const resp = await fetch(resolverUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      },
      redirect: "follow",
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (resp.url && !resp.url.includes("news.google.com") && !resp.url.includes("allorigins")) {
      return resp.url;
    }
    const html = await resp.text();
    // Look for the JS-redirect target inside the Google News HTML
    const m1 = html.match(/data-n-au=["']([^"']+)["']/i);
    if (m1 && m1[1] && !m1[1].includes("news.google.com")) return m1[1];
    const m2 = html.match(/<a[^>]+href=["'](https?:\/\/(?!news\.google\.com|www\.google\.com|policies\.google\.com|accounts\.google\.com|support\.google\.com)[^"']+)["']/i);
    if (m2 && m2[1]) return m2[1];
    const m3 = html.match(/"(https?:\/\/(?!news\.google\.com|www\.google\.com|policies\.google\.com|accounts\.google\.com|support\.google\.com|gstatic\.com|googleusercontent\.com)[^"\\]+)"/);
    if (m3 && m3[1]) return m3[1];
    return url;
  } catch {
    return url;
  }
}

// Try to fetch og:image from a real news URL
async function fetchOgImage(url: string): Promise<string | null> {
  try {
    const realUrl = await resolveGoogleNewsUrl(url);
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const resp = await fetch(realUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!resp.ok) return null;
    const html = await resp.text();
    const patterns = [
      /<meta[^>]+property=["']og:image:secure_url["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+name=["']og:image["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
      /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+itemprop=["']image["'][^>]+content=["']([^"']+)["']/i,
      /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i,
    ];
    for (const p of patterns) {
      const m = html.match(p);
      if (m && m[1]) {
        // Make absolute URL if relative
        try {
          return new URL(m[1], realUrl).toString();
        } catch {
          return m[1];
        }
      }
    }
    // Fallback: first large image in the page
    const firstImg = html.match(/<img[^>]+src=["'](https?:\/\/[^"']+\.(?:jpg|jpeg|png|webp))["']/i);
    if (firstImg) return firstImg[1];
    return null;
  } catch (_e) {
    return null;
  }
}

// Get a favicon as ultimate fallback (always returns something visual)
function getFaviconFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=128`;
  } catch {
    return null;
  }
}

// Generate a deterministic placeholder image based on title (always loads, varied)
function getPlaceholderImage(title: string): string {
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = (hash << 5) - hash + title.charCodeAt(i);
    hash |= 0;
  }
  const seed = Math.abs(hash) % 1000;
  return `https://picsum.photos/seed/news${seed}/600/400`;
}

// Detect Google News generic logo thumbnail (same image for all articles)
function isGoogleNewsGenericThumb(url: string | null): boolean {
  if (!url) return false;
  return url.includes("lh3.googleusercontent.com/J6_coFbogxhRI9iM864NL_liGXvsQp2AupsKei7z0cNN");
}

// Fetch Google News RSS (FREE, no API key needed)
async function fetchGoogleNewsRSS(query: string, maxResults = 12) {
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
    const titles = extractTag(xml, "title").slice(1);
    const links = extractTag(xml, "link").slice(1);
    const pubDates = extractTag(xml, "pubDate");
    const descriptions = extractTag(xml, "description").slice(1);
    const sources = extractTag(xml, "source");

    const articles: any[] = [];
    for (let i = 0; i < titles.length && articles.length < maxResults; i++) {
      const title = titles[i] || "";
      const link = links[i] || "";
      // Skip "Google Notícias" placeholder entries and bare news.google.com links
      if (!title || title.trim() === "Google Notícias") continue;
      if (!link || link === "https://news.google.com/" || link === "https://news.google.com") continue;
      const desc = descriptions[i] || "";
      articles.push({
        title,
        description: desc.replace(/<[^>]*>/g, "").substring(0, 200),
        url: link,
        source: sources[i] || "",
        publishedAt: pubDates[i] || "",
        image: extractImageFromHtml(desc),
      });
    }
    return articles;
  } catch (e) {
    console.error("Google News RSS fetch error:", e);
    return [];
  }
}

// Enrich articles: replace generic Google thumbnails, try real og:image, fallback to varied placeholder
async function enrichWithImages(articles: any[], maxToEnrich = 12) {
  const toEnrich = articles.slice(0, maxToEnrich).map(async (a) => {
    if (!a.url) return a;
    // Replace Google News generic logo thumbnails (same image for all articles)
    if (isGoogleNewsGenericThumb(a.image)) {
      a.image = null;
    }
    // Try to resolve Google News URL to the real article URL
    if (a.url.includes("news.google.com")) {
      const real = await resolveGoogleNewsUrl(a.url);
      if (real && real !== a.url && !real.includes("news.google.com")) {
        a.url = real;
      }
    }
    if (a.image) return a;
    // Try og:image only if we have a real article URL
    if (!a.url.includes("news.google.com")) {
      const img = await fetchOgImage(a.url);
      if (img && !isGoogleNewsGenericThumb(img)) {
        a.image = img;
        return a;
      }
    }
    // Final fallback: deterministic varied placeholder per article
    a.image = getPlaceholderImage(a.title || a.url);
    return a;
  });
  await Promise.all(toEnrich);
  return articles;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SERPAPI_KEY = Deno.env.get("SERPAPI_KEY");
    const NEWS_API_KEY = Deno.env.get("NEWS_API_KEY");

    const body = await req.json().catch(() => ({}));
    const location = body.location || "Brazil";
    const isNational = location === "Brazil";
    console.log("Fetching news for location:", location);

    let articles: any[] = [];

    // Try SerpApi first
    if (SERPAPI_KEY && articles.length === 0) {
      try {
        const gnUrl = new URL("https://serpapi.com/search.json");
        gnUrl.searchParams.set("engine", "google_news");
        gnUrl.searchParams.set("q", isNational
          ? "política eleições governo Brasil"
          : `"${location}" notícias`);
        gnUrl.searchParams.set("gl", "br");
        gnUrl.searchParams.set("hl", "pt");
        gnUrl.searchParams.set("api_key", SERPAPI_KEY);

        const gnResp = await fetch(gnUrl.toString());
        const gnData = await gnResp.json();

        if (gnData.error) {
          console.error("SerpApi google_news error:", gnData.error);
        } else {
          articles = (gnData.news_results || []).slice(0, 12).map((n: any) => ({
            title: n.title || "—",
            description: n.snippet || "",
            url: n.link || "",
            source: n.source?.name || n.source || "",
            publishedAt: n.date || "",
            image: n.thumbnail || null,
          }));
        }
        console.log("SerpApi articles:", articles.length);
      } catch (e) {
        console.error("SerpApi news error:", e);
      }
    }

    // Fallback to News API (already returns urlToImage)
    if (articles.length === 0 && NEWS_API_KEY) {
      try {
        const url = new URL("https://newsapi.org/v2/top-headlines");
        url.searchParams.set("country", "br");
        if (!isNational) url.searchParams.set("q", location);
        url.searchParams.set("pageSize", "12");
        url.searchParams.set("apiKey", NEWS_API_KEY);

        const resp = await fetch(url.toString());
        const data = await resp.json();

        if (data.status === "error") {
          console.error("News API error:", data.message);
        } else {
          articles = (data.articles || [])
            .filter((a: any) => a.title && a.title !== "[Removed]")
            .map((a: any) => ({
              title: a.title,
              description: a.description || "",
              url: a.url,
              source: a.source?.name || "",
              publishedAt: a.publishedAt || "",
              image: a.urlToImage,
            }));
        }
      } catch (e) {
        console.error("News API error:", e);
      }
    }

    // FREE FALLBACK: Google News RSS (no API key needed!)
    if (articles.length === 0) {
      console.log("Using free Google News RSS fallback");
      const query = isNational
        ? "política eleições governo Brasil"
        : `${location} notícias política`;
      articles = await fetchGoogleNewsRSS(query, 12);
    }

    // Enrich with og:image when missing
    const missing = articles.filter((a) => !a.image).length;
    if (missing > 0) {
      console.log(`Enriching ${missing} articles with og:image`);
      articles = await enrichWithImages(articles, 12);
    }

    console.log("Returning", articles.length, "articles");

    return new Response(
      JSON.stringify({ articles }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("News error:", err);
    return new Response(
      JSON.stringify({ error: String(err), articles: [] }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
