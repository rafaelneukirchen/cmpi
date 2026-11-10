import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const API_VERSION = "v25.0";
const FB_BASE = `https://graph.facebook.com/${API_VERSION}`;
const IG_BASE = `https://graph.instagram.com/${API_VERSION}`;

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
    const accessToken = await resolveInstagramToken();
    if (!accessToken) {
      return new Response(
        JSON.stringify({ success: false, error: "INSTAGRAM_ACCESS_TOKEN não configurado" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Detect token type: IG direct (IGAA/IGQ...) vs Facebook Page token (EAA...)
    const isInstagramToken = /^IG[A-Z]{2,3}/i.test(accessToken);

    let profileData: any;
    let postsData: any;

    if (isInstagramToken) {
      // Instagram Graph API direct flow
      const [profileRes, postsRes] = await Promise.all([
        fetch(
          `${IG_BASE}/me?fields=user_id,username,name,profile_picture_url,followers_count,media_count&access_token=${accessToken}`
        ),
        fetch(
          `${IG_BASE}/me/media?fields=id,caption,media_type,media_url,permalink,timestamp&limit=6&access_token=${accessToken}`
        ),
      ]);
      profileData = await profileRes.json();
      postsData = await postsRes.json();
    } else {
      // Facebook Page token flow → resolve linked IG Business Account first
      const accountsRes = await fetch(
        `${FB_BASE}/me/accounts?fields=instagram_business_account&access_token=${accessToken}`
      );
      const accountsData = await accountsRes.json();

      if (accountsData.error) {
        return new Response(
          JSON.stringify({ success: false, error: accountsData.error.message }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const igAccountId = accountsData?.data?.find(
        (p: any) => p.instagram_business_account?.id
      )?.instagram_business_account?.id;

      if (!igAccountId) {
        return new Response(
          JSON.stringify({ success: false, error: "Nenhuma conta do Instagram Business vinculada à página." }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const [profileRes, postsRes] = await Promise.all([
        fetch(
          `${FB_BASE}/${igAccountId}?fields=username,name,profile_picture_url,followers_count,media_count&access_token=${accessToken}`
        ),
        fetch(
          `${FB_BASE}/${igAccountId}/media?fields=id,caption,media_type,media_url,permalink,timestamp&limit=6&access_token=${accessToken}`
        ),
      ]);
      profileData = await profileRes.json();
      postsData = await postsRes.json();
    }

    if (profileData?.error) {
      return new Response(
        JSON.stringify({ success: false, error: profileData.error.message }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        profile: profileData,
        posts: postsData?.data || [],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
