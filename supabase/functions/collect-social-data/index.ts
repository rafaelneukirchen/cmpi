import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const IG_API_VERSION = "v25.0";

function buildProfileUrl(username: string, platform: string): string {
  switch (platform) {
    case "youtube": return `https://www.youtube.com/@${username}`;
    case "instagram": return `https://www.instagram.com/${username}/`;
    case "twitter": return `https://x.com/${username}`;
    case "facebook": return `https://www.facebook.com/${username}`;
    case "tiktok": return `https://www.tiktok.com/@${username}`;
    default: return "";
  }
}

// ========== Instagram Graph API (own account via graph.instagram.com) ==========
async function fetchInstagramOwnProfile(accessToken: string): Promise<{ data: any; error?: string }> {
  try {
    const res = await fetch(
      `https://graph.instagram.com/${IG_API_VERSION}/me?fields=user_id,username,name,profile_picture_url,followers_count,media_count&access_token=${accessToken}`
    );
    const data = await res.json();

    if (data.error) {
      const isExpired = data.error.code === 190;
      return {
        data: null,
        error: isExpired
          ? "TOKEN_EXPIRADO: O token do Instagram expirou. Atualize nas configurações."
          : `Erro API: ${data.error.message}`,
      };
    }

    return {
      data: {
        username: data.username,
        seguidores: data.followers_count || 0,
        total_posts: data.media_count || 0,
        engajamento: 0,
        foto_url: data.profile_picture_url || null,
        nome: data.name || null,
      },
    };
  } catch (err) {
    return { data: null, error: `Erro: ${err instanceof Error ? err.message : "Unknown"}` };
  }
}

// ========== Instagram Business Discovery (requires Facebook Page token) ==========
async function fetchInstagramBusinessDiscovery(
  username: string,
  fbPageToken: string
): Promise<{ data: any; error?: string }> {
  try {
    // Get pages with IG Business accounts
    const pagesRes = await fetch(
      `https://graph.facebook.com/${IG_API_VERSION}/me/accounts?fields=id,name,instagram_business_account&access_token=${fbPageToken}`
    );
    const pagesData = await pagesRes.json();

    if (pagesData.error) {
      return { data: null }; // Silently fail - token is not a FB token
    }

    const pagesWithIg = (pagesData.data || []).filter((p: any) => p.instagram_business_account);
    if (pagesWithIg.length === 0) return { data: null };

    const actorIgId = pagesWithIg[0].instagram_business_account.id;

    const discoveryRes = await fetch(
      `https://graph.facebook.com/${IG_API_VERSION}/${actorIgId}?fields=business_discovery.fields(username,name,followers_count,media_count,profile_picture_url).username(${username})&access_token=${fbPageToken}`
    );
    const discoveryData = await discoveryRes.json();

    if (discoveryData.business_discovery) {
      const bd = discoveryData.business_discovery;
      return {
        data: {
          seguidores: bd.followers_count || 0,
          total_posts: bd.media_count || 0,
          engajamento: 0,
          foto_url: bd.profile_picture_url || null,
          nome: bd.name || null,
        },
      };
    }

    if (discoveryData.error) {
      const code = discoveryData.error.code;
      const subcode = discoveryData.error.error_subcode;
      if (code === 803 || subcode === 2207013) {
        return { data: null, error: `@${username} não é conta Business/Creator.` };
      }
    }

    return { data: null };
  } catch {
    return { data: null };
  }
}

// ========== Main handler ==========
async function requireAuthOrServiceRole(req: Request): Promise<boolean> {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (authHeader.includes(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "__none__")) return true;
  if (!authHeader.startsWith("Bearer ")) return false;
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

  if (!(await requireAuthOrServiceRole(req))) {
    return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({}));
    const { profile_id, profile_ids } = body;

    const ids: string[] = profile_ids || (profile_id ? [profile_id] : []);

    if (ids.length === 0) {
      const { data: allProfiles } = await supabase
        .from("social_discovery_profiles")
        .select("id")
        .eq("ativo", true);
      if (allProfiles) {
        ids.push(...allProfiles.map((p: any) => p.id));
      }
    }

    // Load credentials - DB has priority (auto-refreshed token), env as fallback
    let igToken: string | null = null;
    {
      const { data: igCred } = await supabase
        .from("system_api_credentials")
        .select("access_token")
        .eq("plataforma", "instagram")
        .eq("status", "ativo")
        .maybeSingle();
      igToken = igCred?.access_token || Deno.env.get("INSTAGRAM_ACCESS_TOKEN") || null;
    }

    // Check DB for FB page tokens (different from IG user token)
    let fbPageToken: string | null = null;
    const { data: credentials } = await supabase
      .from("system_api_credentials")
      .select("plataforma, access_token, status")
      .eq("status", "ativo");

    if (credentials) {
      for (const c of credentials) {
        if (c.plataforma === "facebook") fbPageToken = c.access_token;
      }
    }

    console.log(`[collect] IG token: ${igToken ? "yes" : "no"}, FB page token: ${fbPageToken ? "yes" : "no"}`);

    // Get own IG username for matching
    let ownIgUsername: string | null = null;
    let ownIgData: any = null;
    if (igToken) {
      const ownResult = await fetchInstagramOwnProfile(igToken);
      if (ownResult.data) {
        ownIgUsername = ownResult.data.username?.toLowerCase() || null;
        ownIgData = ownResult.data;
        console.log(`[collect] Own IG account: @${ownIgUsername} (${ownIgData.seguidores} followers)`);
      } else if (ownResult.error) {
        console.log(`[collect] Own IG error: ${ownResult.error}`);
      }
    }

    const results: any[] = [];

    for (const id of ids) {
      try {
        const { data: profile } = await supabase
          .from("social_discovery_profiles")
          .select("*")
          .eq("id", id)
          .single();

        if (!profile) {
          results.push({ id, success: false, error: "Perfil não encontrado" });
          continue;
        }

        console.log(`[collect] Processing: ${profile.nome} (@${profile.username}) - ${profile.plataforma}`);

        let extracted: { seguidores: number; total_posts: number; engajamento: number } | null = null;
        let photoUrl: string | null = null;

        if (profile.plataforma === "instagram") {
          const profileUsername = profile.username.toLowerCase();

          // Check if it's our own account
          if (ownIgUsername && profileUsername === ownIgUsername && ownIgData) {
            extracted = {
              seguidores: ownIgData.seguidores,
              total_posts: ownIgData.total_posts,
              engajamento: ownIgData.engajamento,
            };
            photoUrl = ownIgData.foto_url;
            console.log(`[collect] ✅ Own account: ${extracted.seguidores} followers`);
          }
          // Try Business Discovery with FB page token
          else if (fbPageToken) {
            const bdResult = await fetchInstagramBusinessDiscovery(profile.username, fbPageToken);
            if (bdResult.data && bdResult.data.seguidores > 0) {
              extracted = {
                seguidores: bdResult.data.seguidores,
                total_posts: bdResult.data.total_posts,
                engajamento: bdResult.data.engajamento,
              };
              photoUrl = bdResult.data.foto_url;
              console.log(`[collect] ✅ Business Discovery: ${extracted.seguidores} followers`);
            }
          }

          // No API data available for this profile
          if (!extracted) {
            results.push({
              id,
              success: false,
              error: `Dados de @${profile.username} não disponíveis via API. Use "Registrar Dados" para inserir manualmente.`,
              needsManual: true,
            });
            continue;
          }
        } else {
          // Other platforms - no API available currently
          results.push({
            id,
            success: false,
            error: `Coleta automática de ${profile.plataforma} não disponível. Use "Registrar Dados" para inserir manualmente.`,
            needsManual: true,
          });
          continue;
        }

        // Update profile photo
        if (photoUrl && photoUrl !== profile.foto_url) {
          await supabase.from("social_discovery_profiles").update({ foto_url: photoUrl }).eq("id", id);
        }

        // Growth calculation
        const { data: prevMetrics } = await supabase
          .from("social_metrics")
          .select("seguidores")
          .eq("profile_id", id)
          .order("data_coleta", { ascending: false })
          .limit(1);

        let crescimento = 0;
        if (prevMetrics?.[0]?.seguidores && extracted.seguidores > 0) {
          crescimento = ((extracted.seguidores - prevMetrics[0].seguidores) / prevMetrics[0].seguidores) * 100;
        }

        // Save metrics
        await supabase.from("social_metrics").insert({
          profile_id: id,
          seguidores: extracted.seguidores,
          total_posts: extracted.total_posts,
          engajamento: extracted.engajamento,
          crescimento: Math.round(crescimento * 10) / 10,
        });

        // Update score
        const score =
          (extracted.seguidores > 0 ? Math.log10(extracted.seguidores) * 40 : 0) +
          extracted.engajamento * 30 +
          Math.max(0, crescimento) * 30;

        const updateData: any = { score: Math.round(score * 10) / 10 };
        if (photoUrl) updateData.foto_url = photoUrl;

        await supabase.from("social_discovery_profiles").update(updateData).eq("id", id);

        results.push({
          id,
          success: true,
          seguidores: extracted.seguidores,
          total_posts: extracted.total_posts,
          crescimento: Math.round(crescimento * 10) / 10,
        });
      } catch (err) {
        console.error(`[collect] Error for ${id}:`, err);
        results.push({ id, success: false, error: err instanceof Error ? err.message : "Erro desconhecido" });
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[collect] Fatal error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
