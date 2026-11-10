import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const API_VERSION = "v25.0";
const FB_BASE = `https://graph.facebook.com/${API_VERSION}`;

async function resolveInstagramToken(): Promise<string | null> {
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (url && key) {
      const sb = createClient(url, key);
      const { data } = await sb
        .from("system_api_credentials")
        .select("access_token")
        .eq("plataforma", "instagram")
        .eq("status", "ativo")
        .maybeSingle();
      if (data?.access_token) return data.access_token;
    }
  } catch (_) { /* ignore */ }
  return Deno.env.get("INSTAGRAM_ACCESS_TOKEN") ?? null;
}

async function fetchJson(url: string) {
  const res = await fetch(url);
  return res.json();
}

async function analyzeThemes(captions: string[]): Promise<{ tema: string; mencoes: number }[]> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey || captions.length === 0) return [];
  const text = captions.filter(Boolean).slice(0, 30).join("\n---\n").slice(0, 8000);
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "Você é analista político-eleitoral. Identifique os 5 principais temas/assuntos abordados nas legendas. Retorne APENAS JSON válido no formato: {\"temas\":[{\"tema\":\"nome curto em PT-BR\",\"mencoes\":N}]}. Sem markdown.",
          },
          { role: "user", content: text },
        ],
      }),
    });
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content || "{}";
    const cleaned = content.replace(/```json\s*|\s*```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed?.temas) ? parsed.temas.slice(0, 5) : [];
  } catch (e) {
    console.error("[themes] error", e);
    return [];
  }
}

async function requireAuth(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;
  const anonKey =
    Deno.env.get("SUPABASE_ANON_KEY") ??
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ??
    Deno.env.get("SUPABASE_PUBLISHABLE_DEFAULT_KEY");
  if (!anonKey) return false;
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data, error } = await sb.auth.getUser();
    return !error && !!data?.user;
  } catch (e) {
    console.error("[auth] error", e);
    return false;
  }
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Allow service-role/cron; otherwise require authenticated user.
  const authHeader = req.headers.get("Authorization") ?? "";
  const isServiceRole = authHeader.includes(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "__none__");
  if (!isServiceRole && !(await requireAuth(req))) {
    return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const action = body?.action || "snapshot_all";

    const token = await resolveInstagramToken();
    if (!token) {
      return new Response(
        JSON.stringify({ success: false, error: "INSTAGRAM_ACCESS_TOKEN não configurado" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Business Discovery requires FB Page token vinculado a IG Business
    const isIG = /^IG[A-Z]{2,3}/i.test(token);
    if (isIG) {
      return new Response(
        JSON.stringify({
          success: false,
          error:
            "Token atual é Instagram direto. Comparativo requer token de Facebook Page vinculado a uma conta Business/Creator do Instagram (Business Discovery API).",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accsUrl = `${FB_BASE}/me/accounts?fields=access_token,instagram_business_account&limit=50&access_token=${token}`;
    const accs = await fetchJson(accsUrl);
    const acc = (accs?.data || []).find((a: any) => a.instagram_business_account?.id);
    if (!acc) {
      return new Response(
        JSON.stringify({ success: false, error: "Nenhuma conta IG Business encontrada no token." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const myIgId = acc.instagram_business_account.id;
    const pageToken = acc.access_token || token;

    // Pick competitors
    const sbUrl = Deno.env.get("SUPABASE_URL")!;
    const sbKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(sbUrl, sbKey);

    let competitors: any[] = [];
    if (action === "refresh_one" && body?.competitor_id) {
      const { data } = await sb.from("social_competitors").select("*").eq("id", body.competitor_id).maybeSingle();
      if (data) competitors = [data];
    } else {
      const { data } = await sb.from("social_competitors").select("*").eq("ativo", true);
      competitors = data || [];
    }

    if (competitors.length === 0) {
      return new Response(
        JSON.stringify({ success: true, processed: 0, message: "Nenhum concorrente cadastrado." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: any[] = [];
    const errors: any[] = [];

    for (const c of competitors) {
      try {
        const fields = `business_discovery.username(${c.username}){username,name,biography,profile_picture_url,followers_count,follows_count,media_count,media.limit(25){id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count}}`;
        const url = `${FB_BASE}/${myIgId}?fields=${encodeURIComponent(fields)}&access_token=${pageToken}`;
        const json = await fetchJson(url);

        if (json?.error) {
          errors.push({ username: c.username, error: json.error.message });
          continue;
        }

        const bd = json?.business_discovery;
        if (!bd) {
          errors.push({ username: c.username, error: "Perfil não encontrado ou não é Business/Creator." });
          continue;
        }

        const media = bd.media?.data || [];
        const totalLikes = media.reduce((s: number, m: any) => s + (m.like_count || 0), 0);
        const totalComments = media.reduce((s: number, m: any) => s + (m.comments_count || 0), 0);
        const totalInter = totalLikes + totalComments;
        const followers = bd.followers_count || 0;
        const avgEng = media.length > 0 && followers > 0
          ? Number(((totalInter / media.length / followers) * 100).toFixed(2))
          : 0;

        const topPosts = [...media]
          .sort((a: any, b: any) => (b.like_count + b.comments_count) - (a.like_count + a.comments_count))
          .slice(0, 5)
          .map((m: any) => ({
            id: m.id,
            caption: (m.caption || "").slice(0, 200),
            permalink: m.permalink,
            mediaUrl: m.media_url,
            thumbnailUrl: m.thumbnail_url,
            mediaType: m.media_type,
            timestamp: m.timestamp,
            likeCount: m.like_count || 0,
            commentsCount: m.comments_count || 0,
          }));

        const themes = await analyzeThemes(media.map((m: any) => m.caption || ""));

        const today = new Date().toISOString().split("T")[0];
        await sb.from("social_competitor_snapshots").upsert({
          competitor_id: c.id,
          snapshot_date: today,
          followers,
          follows: bd.follows_count || 0,
          media_count: bd.media_count || 0,
          total_likes: totalLikes,
          total_comments: totalComments,
          avg_engagement: avgEng,
          top_posts: topPosts,
          themes,
          profile_picture_url: bd.profile_picture_url || null,
          biography: bd.biography || null,
        }, { onConflict: "competitor_id,snapshot_date" });

        // sync display_name if empty
        if (!c.display_name && bd.name) {
          await sb.from("social_competitors").update({ display_name: bd.name }).eq("id", c.id);
        }

        results.push({ username: c.username, followers, avgEng, posts: media.length });
      } catch (e) {
        errors.push({ username: c.username, error: e instanceof Error ? e.message : String(e) });
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed: results.length, results, errors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[instagram-competitors] Error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
