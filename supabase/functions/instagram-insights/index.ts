import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const API_VERSION = "v25.0";

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
const FB_BASE = `https://graph.facebook.com/${API_VERSION}`;
const IG_BASE = `https://graph.instagram.com/${API_VERSION}`;

function buildUrl(base: string, path: string, params: Record<string, string>) {
  const url = new URL(`${base}${path}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });
  return url.toString();
}

async function fetchJson(base: string, path: string, params: Record<string, string>) {
  const res = await fetch(buildUrl(base, path, params));
  return res.json();
}

function getMetricValue(metric: any) {
  if (metric?.total_value?.value != null) return Number(metric.total_value.value) || 0;
  if (metric?.values?.[0]?.value != null) return Number(metric.values[0].value) || 0;
  return 0;
}

function debugCredential(token: string) {
  return {
    length: token.length,
    prefix: token.substring(0, 4),
    suffix: token.substring(Math.max(0, token.length - 4)),
  };
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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (!(await requireAuth(req))) {
    return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const userAccessToken = await resolveInstagramToken();
    if (!userAccessToken) {
      return new Response(
        JSON.stringify({ success: false, error: "INSTAGRAM_ACCESS_TOKEN não configurado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[instagram-insights] Using token metadata:", JSON.stringify(debugCredential(userAccessToken)));

    // Detect token type:
    // - "IGAA..." or "IGQ..." → Instagram Graph API (login direto via Instagram)
    // - everything else → Facebook Graph API (Page/User token vinculado a IG Business)
    const isInstagramToken = /^IG[A-Z]{2,3}/i.test(userAccessToken);
    let apiBase = isInstagramToken ? IG_BASE : FB_BASE;
    let pageAccessToken = userAccessToken;
    let igAccount: any = null;
    let pageInfo: { id: string | null; name: string | null } = { id: null, name: null };

    if (isInstagramToken) {
      // Token direto do Instagram → /me retorna a conta
      const meRes = await fetchJson(IG_BASE, "/me", {
        fields: "user_id,username,name,account_type,profile_picture_url,followers_count,follows_count,media_count",
        access_token: userAccessToken,
      });

      if (meRes?.error) {
        return new Response(
          JSON.stringify({ success: false, error: meRes.error.message || "Erro ao validar token do Instagram" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      igAccount = {
        id: meRes.user_id || meRes.id,
        username: meRes.username,
        name: meRes.name || meRes.username,
        profile_picture_url: meRes.profile_picture_url,
        followers_count: meRes.followers_count,
        follows_count: meRes.follows_count,
        media_count: meRes.media_count,
      };
    } else {
      // Facebook Page/User token → resolve a IG Business Account vinculada à Página
      const accountsRes = await fetchJson(FB_BASE, "/me/accounts", {
        fields: "id,name,access_token,instagram_business_account{id,username,name,profile_picture_url,followers_count,follows_count,media_count}",
        limit: "50",
        access_token: userAccessToken,
      });

      if (accountsRes?.error) {
        return new Response(
          JSON.stringify({ success: false, error: accountsRes.error.message || "Erro ao listar contas da Meta" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const accounts = Array.isArray(accountsRes?.data) ? accountsRes.data : [];
      const accountWithInstagram = accounts.find((account: any) => account.instagram_business_account?.id);

      if (!accountWithInstagram?.instagram_business_account?.id) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Nenhuma conta profissional do Instagram foi encontrada nesse token. Verifique se o token pertence à conta Meta correta e se há uma Página conectada ao Instagram Business.",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      pageAccessToken = accountWithInstagram.access_token || userAccessToken;
      igAccount = accountWithInstagram.instagram_business_account;
      pageInfo = { id: accountWithInstagram.id, name: accountWithInstagram.name };
    }

    const igUserId = igAccount.id;
    console.log(
      `[instagram-insights] Mode=${isInstagramToken ? "IG_TOKEN" : "FB_TOKEN"} → IG account ${igUserId} (@${igAccount.username})`
    );

    let profileViews = 0;
    try {
      const pvRes = await fetchJson(apiBase, `/${igUserId}/insights`, {
        metric: "profile_views",
        metric_type: "total_value",
        period: "day",
        access_token: pageAccessToken,
      });

      if (pvRes?.data?.[0]) {
        profileViews = getMetricValue(pvRes.data[0]);
      } else if (pvRes?.error) {
        console.log(`[instagram-insights] profile_views error: ${pvRes.error.message}`);
      }
    } catch (e) {
      console.log("[instagram-insights] profile_views exception", e);
    }

    // Janela de análise: últimos 30 dias (ranking mensal)
    const WINDOW_DAYS = 30;
    const windowStart = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);

    const mediaRes = await fetchJson(apiBase, `/${igUserId}/media`, {
      fields: "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count",
      limit: "50",
      access_token: pageAccessToken,
    });

    if (mediaRes?.error) {
      return new Response(
        JSON.stringify({ success: false, error: mediaRes.error.message || "Erro ao carregar publicações" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const allPosts = Array.isArray(mediaRes?.data) ? mediaRes.data : [];
    // Mantém apenas posts dos últimos 15 dias
    const posts = allPosts.filter((p: any) => {
      if (!p.timestamp) return false;
      return new Date(p.timestamp) >= windowStart;
    });
    console.log(`[instagram-insights] Posts last ${WINDOW_DAYS} days: ${posts.length} of ${allPosts.length}`);

    let insightsAvailable = false;
    const postsWithInsights = await Promise.all(
      posts.map(async (post: any) => {
        try {
          // v22.0+: 'impressions' e 'plays' foram descontinuadas; 'views' é a métrica unificada
          const metricsToFetch = post.media_type === "VIDEO" || post.media_type === "REEL"
            ? "views,reach,saved,shares,total_interactions,likes,comments"
            : "views,reach,saved,shares,total_interactions,likes,comments";

          const insightsRes = await fetchJson(apiBase, `/${post.id}/insights`, {
            metric: metricsToFetch,
            access_token: pageAccessToken,
          });

          const insights: Record<string, number> = {};
          if (Array.isArray(insightsRes?.data)) {
            insightsAvailable = true;
            for (const metric of insightsRes.data) {
              insights[metric.name] = getMetricValue(metric);
            }
          } else if (insightsRes?.error) {
            console.log(`[instagram-insights] Insights error for post ${post.id}: ${insightsRes.error.message}`);
          }

          return { ...post, insights };
        } catch (error) {
          console.log(`[instagram-insights] Insights exception for post ${post.id}:`, error);
          return { ...post, insights: {} };
        }
      })
    );

    const postsWithComments = postsWithInsights.filter((p: any) => (p.comments_count || 0) > 0);
    console.log(`[instagram-insights] Posts with comments: ${postsWithComments.length}`);

    const engagerMap: Record<string, { count: number; lastDate: string }> = {};
    const userInteractions: Record<string, Array<{
      postId: string;
      postCaption: string;
      postPermalink: string;
      postMediaUrl: string;
      postThumbnailUrl: string;
      postMediaType: string;
      commentText: string;
      timestamp: string;
      postTimestamp: string;
    }>> = {};
    let commentsApiAvailable = false;
    let commentsReturned = 0;

    const recordInteraction = (
      username: string,
      timestamp: string,
      text: string,
      post: any
    ) => {
      const uname = username.toLowerCase();
      if (!engagerMap[uname]) {
        engagerMap[uname] = { count: 0, lastDate: timestamp };
      }
      engagerMap[uname].count++;
      if (timestamp > engagerMap[uname].lastDate) {
        engagerMap[uname].lastDate = timestamp;
      }
      if (!userInteractions[uname]) userInteractions[uname] = [];
      userInteractions[uname].push({
        postId: post.id,
        postCaption: (post.caption || "").slice(0, 80),
        postPermalink: post.permalink,
        postMediaUrl: post.media_url || "",
        postThumbnailUrl: post.thumbnail_url || "",
        postMediaType: post.media_type || "",
        commentText: text || "",
        timestamp,
        postTimestamp: post.timestamp,
      });
    };

    // Fase 1: buscar comentários de TODOS os posts em paralelo
    const commentsResults = await Promise.all(
      postsWithComments.map(async (post: any) => {
        try {
          const commentsRes = await fetchJson(apiBase, `/${post.id}/comments`, {
            fields: "id,text,username,timestamp",
            limit: "50",
            access_token: pageAccessToken,
          });
          if (commentsRes?.error) {
            console.log(
              `[instagram-insights] Comments API error for post ${post.id}: ${commentsRes.error.message}`
            );
            return { post, comments: [] as any[] };
          }
          return { post, comments: Array.isArray(commentsRes?.data) ? commentsRes.data : [] };
        } catch (err) {
          console.log(`[instagram-insights] Error fetching comments for post ${post.id}:`, err);
          return { post, comments: [] as any[] };
        }
      })
    );

    // Processa comentários e coleta tarefas de replies
    const replyTasks: Array<{ post: any; commentId: string }> = [];
    for (const { post, comments } of commentsResults) {
      if (comments.length > 0) commentsApiAvailable = true;
      commentsReturned += comments.length;
      for (const c of comments) {
        if (c.username) recordInteraction(c.username, c.timestamp, c.text, post);
        if (c.id) replyTasks.push({ post, commentId: c.id });
      }
    }

    // Fase 2: buscar replies em paralelo (limitado a 80 para evitar rate limit)
    const repliesToFetch = replyTasks.slice(0, 80);
    const repliesResults = await Promise.all(
      repliesToFetch.map(async ({ post, commentId }) => {
        try {
          const repliesRes = await fetchJson(apiBase, `/${commentId}/replies`, {
            fields: "id,text,username,timestamp",
            limit: "25",
            access_token: pageAccessToken,
          });
          return { post, replies: Array.isArray(repliesRes?.data) ? repliesRes.data : [] };
        } catch {
          return { post, replies: [] as any[] };
        }
      })
    );

    for (const { post, replies } of repliesResults) {
      for (const r of replies) {
        if (r.username) recordInteraction(r.username, r.timestamp, r.text, post);
      }
    }

    const totalCommentsExpected = postsWithComments.reduce((sum: number, post: any) => sum + (post.comments_count || 0), 0);
    const commentsPermissionMissing = totalCommentsExpected > 0 && commentsReturned === 0;

    console.log(
      `[instagram-insights] Total engagers found: ${Object.keys(engagerMap).length}, comments API available: ${commentsApiAvailable}, expected comments: ${totalCommentsExpected}, returned comments: ${commentsReturned}, permission/account issue: ${commentsPermissionMissing}`
    );

    const topEngagers = Object.entries(engagerMap)
      .map(([username, data]) => ({ username, comments: data.count, lastInteraction: data.lastDate }))
      .sort((a, b) => b.comments - a.comments);
    // Top 20 para ranking visual; userInteractions contém TODOS para lookup de tracked users

    const totalLikes = postsWithInsights.reduce((s: number, p: any) => s + (p.like_count || 0), 0);
    const totalComments = postsWithInsights.reduce((s: number, p: any) => s + (p.comments_count || 0), 0);
    const totalReach = postsWithInsights.reduce((s: number, p: any) => s + (p.insights?.reach || 0), 0);
    // v22.0+: 'views' substitui 'impressions' e 'plays' (mantemos os nomes antigos no payload para compatibilidade do frontend)
    const totalImpressions = postsWithInsights.reduce((s: number, p: any) => s + (p.insights?.views || p.insights?.impressions || 0), 0);
    const totalSaves = postsWithInsights.reduce((s: number, p: any) => s + (p.insights?.saved || 0), 0);
    const totalShares = postsWithInsights.reduce((s: number, p: any) => s + (p.insights?.shares || 0), 0);
    const totalPlays = postsWithInsights.reduce((s: number, p: any) => s + (p.insights?.views || p.insights?.plays || 0), 0);

    const avgEngagement = posts.length > 0 && (igAccount.followers_count || 0) > 0
      ? ((totalLikes + totalComments) / posts.length / igAccount.followers_count * 100)
      : 0;

    const bestByLikes = [...postsWithInsights].sort((a, b) => (b.like_count || 0) - (a.like_count || 0)).slice(0, 5);
    const bestByComments = [...postsWithInsights].sort((a, b) => (b.comments_count || 0) - (a.comments_count || 0)).slice(0, 5);
    const bestByReach = [...postsWithInsights].sort((a, b) => (b.insights?.reach || 0) - (a.insights?.reach || 0)).slice(0, 5);
    const bestByShares = [...postsWithInsights].sort((a, b) => (b.insights?.shares || 0) - (a.insights?.shares || 0)).slice(0, 5);

    const typeBreakdown: Record<string, { count: number; likes: number; comments: number }> = {};
    for (const p of postsWithInsights) {
      const type = p.media_type || "UNKNOWN";
      if (!typeBreakdown[type]) typeBreakdown[type] = { count: 0, likes: 0, comments: 0 };
      typeBreakdown[type].count++;
      typeBreakdown[type].likes += p.like_count || 0;
      typeBreakdown[type].comments += p.comments_count || 0;
    }

    return new Response(
      JSON.stringify({
        success: true,
        profile: {
          username: igAccount.username,
          name: igAccount.name,
          picture: igAccount.profile_picture_url,
          followers: igAccount.followers_count || 0,
          following: igAccount.follows_count || 0,
          mediaCount: igAccount.media_count || 0,
          profileViews,
        },
        summary: {
          totalPosts: posts.length,
          totalLikes,
          totalComments,
          totalReach,
          totalImpressions,
          totalSaves,
          totalShares,
          totalPlays,
          profileViews,
          avgEngagement: Math.round(avgEngagement * 100) / 100,
        },
        capabilities: {
          insights: insightsAvailable,
          comments: commentsApiAvailable,
          commentsPermissionMissing,
          totalCommentsExpected,
          totalCommentsReturned: commentsReturned,
        },
        debug: {
          mode: isInstagramToken ? "IG_TOKEN" : "FB_TOKEN",
          pageId: pageInfo.id,
          pageName: pageInfo.name,
          igUserId,
        },
        bestByLikes,
        bestByComments,
        bestByReach,
        bestByShares,
        topEngagers,
        userInteractions,
        typeBreakdown,
        recentPosts: postsWithInsights.slice(0, 12),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[instagram-insights] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});