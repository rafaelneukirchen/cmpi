import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const API_VERSION = "v25.0";
const FB_BASE = `https://graph.facebook.com/${API_VERSION}`;
const IG_BASE = `https://graph.instagram.com/${API_VERSION}`;

/** Resolve token: DB (auto-refreshed) → ENV fallback */
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
  } catch (_) { /* fallthrough */ }
  return Deno.env.get("INSTAGRAM_ACCESS_TOKEN") ?? null;
}

function buildUrl(base: string, path: string, params: Record<string, string>) {
  const url = new URL(`${base}${path}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v) url.searchParams.set(k, v);
  });
  return url.toString();
}

async function fetchJson(base: string, path: string, params: Record<string, string>) {
  const res = await fetch(buildUrl(base, path, params));
  return res.json();
}

async function requireAuth(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data, error } = await sb.auth.getUser();
  return !error && !!data?.user;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (!(await requireAuth(req))) {
    return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const token = await resolveInstagramToken();
    if (!token) {
      return new Response(
        JSON.stringify({ success: false, error: "INSTAGRAM_ACCESS_TOKEN não configurado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Resolve IG account (mesma lógica do instagram-insights)
    const isIG = /^IG[A-Z]{2,3}/i.test(token);
    const apiBase = isIG ? IG_BASE : FB_BASE;
    let pageToken = token;
    let igUserId: string | null = null;
    let igUsername: string | null = null;

    if (isIG) {
      const me = await fetchJson(IG_BASE, "/me", {
        fields: "user_id,username",
        access_token: token,
      });
      if (me?.error) {
        return new Response(
          JSON.stringify({ success: false, error: me.error.message }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      igUserId = me.user_id || me.id;
      igUsername = me.username;
    } else {
      const accs = await fetchJson(FB_BASE, "/me/accounts", {
        fields: "access_token,instagram_business_account{id,username}",
        limit: "50",
        access_token: token,
      });
      const acc = (accs?.data || []).find((a: any) => a.instagram_business_account?.id);
      if (!acc) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Nenhuma conta profissional do Instagram encontrada nesse token.",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      pageToken = acc.access_token || token;
      igUserId = acc.instagram_business_account.id;
      igUsername = acc.instagram_business_account.username;
    }

    // Janela: últimos 30 dias
    const WINDOW_DAYS = 30;
    const windowStart = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);

    // mentioned_media: posts em que outras contas marcaram seu @
    // Endpoint requer permissão `instagram_manage_comments`
    const tagsRes = await fetchJson(apiBase, `/${igUserId}/tags`, {
      fields:
        "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,username,like_count,comments_count,owner",
      limit: "50",
      access_token: pageToken,
    });

    if (tagsRes?.error) {
      const code = tagsRes.error.code;
      const msg = tagsRes.error.message || "Erro ao buscar menções";
      // 10/200 = permissão; 100 = endpoint indisponível para o tipo de conta
      const isPerm = code === 10 || code === 200 || /permission/i.test(msg);
      return new Response(
        JSON.stringify({
          success: false,
          error: msg,
          permissionMissing: isPerm,
          requiredScope: "instagram_manage_comments",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const allMentions = Array.isArray(tagsRes?.data) ? tagsRes.data : [];
    const mentions = allMentions.filter((m: any) => {
      if (!m.timestamp) return false;
      return new Date(m.timestamp) >= windowStart;
    });

    // Agrupa por @ mencionante
    const byUser: Record<
      string,
      {
        username: string;
        count: number;
        lastMention: string;
        posts: Array<{
          id: string;
          caption: string;
          permalink: string;
          mediaUrl: string;
          thumbnailUrl: string;
          mediaType: string;
          timestamp: string;
          likeCount: number;
          commentsCount: number;
        }>;
      }
    > = {};

    for (const m of mentions) {
      const u = (m.username || "desconhecido").toLowerCase();
      if (!byUser[u]) {
        byUser[u] = { username: u, count: 0, lastMention: m.timestamp, posts: [] };
      }
      byUser[u].count++;
      if (m.timestamp > byUser[u].lastMention) byUser[u].lastMention = m.timestamp;
      byUser[u].posts.push({
        id: m.id,
        caption: (m.caption || "").slice(0, 200),
        permalink: m.permalink || "",
        mediaUrl: m.media_url || "",
        thumbnailUrl: m.thumbnail_url || "",
        mediaType: m.media_type || "",
        timestamp: m.timestamp,
        likeCount: m.like_count || 0,
        commentsCount: m.comments_count || 0,
      });
    }

    const topMentioners = Object.values(byUser).sort((a, b) => b.count - a.count);

    return new Response(
      JSON.stringify({
        success: true,
        myUsername: igUsername,
        windowDays: WINDOW_DAYS,
        totalMentions: mentions.length,
        uniqueMentioners: topMentioners.length,
        topMentioners,
        recentMentions: mentions.slice(0, 20).map((m: any) => ({
          id: m.id,
          username: (m.username || "").toLowerCase(),
          caption: (m.caption || "").slice(0, 200),
          permalink: m.permalink || "",
          mediaUrl: m.media_url || "",
          thumbnailUrl: m.thumbnail_url || "",
          mediaType: m.media_type || "",
          timestamp: m.timestamp,
          likeCount: m.like_count || 0,
          commentsCount: m.comments_count || 0,
        })),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[instagram-mentions] Error:", err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : "Erro desconhecido",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
