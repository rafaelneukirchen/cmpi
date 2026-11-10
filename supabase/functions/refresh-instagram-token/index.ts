import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const API_VERSION = "v25.0";
const FB_BASE = `https://graph.facebook.com/${API_VERSION}`;

/**
 * Resolves the current Instagram/Facebook token.
 * Priority: DB (system_api_credentials.instagram) → ENV (INSTAGRAM_ACCESS_TOKEN)
 */
async function getCurrentToken(supabase: any): Promise<string | null> {
  const { data } = await supabase
    .from("system_api_credentials")
    .select("access_token")
    .eq("plataforma", "instagram")
    .eq("status", "ativo")
    .maybeSingle();
  if (data?.access_token) return data.access_token;
  return Deno.env.get("INSTAGRAM_ACCESS_TOKEN") ?? null;
}

async function requireAdmin(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data, error } = await sb.auth.getUser();
  if (error || !data?.user) return false;
  const { data: ok } = await sb.rpc("has_role", { _user_id: data.user.id, _role: "admin" });
  return !!ok;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Allow cron/service-role invocations (no JWT) but require admin for user calls.
  const authHeader = req.headers.get("Authorization") ?? "";
  const isServiceRole = authHeader.includes(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "__none__");
  if (!isServiceRole && !(await requireAdmin(req))) {
    return new Response(JSON.stringify({ success: false, error: "Forbidden" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const APP_ID = Deno.env.get("META_APP_ID");
    const APP_SECRET = Deno.env.get("META_APP_SECRET");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!APP_ID || !APP_SECRET) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "META_APP_ID ou META_APP_SECRET não configurados",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
    const currentToken = await getCurrentToken(supabase);

    if (!currentToken) {
      return new Response(
        JSON.stringify({ success: false, error: "Nenhum token atual encontrado" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Exchange current long-lived token for a new long-lived token (extends ~60d)
    const url = new URL(`${FB_BASE}/oauth/access_token`);
    url.searchParams.set("grant_type", "fb_exchange_token");
    url.searchParams.set("client_id", APP_ID);
    url.searchParams.set("client_secret", APP_SECRET);
    url.searchParams.set("fb_exchange_token", currentToken);

    const res = await fetch(url.toString());
    const json = await res.json();

    if (!res.ok || json.error || !json.access_token) {
      console.error("[refresh-instagram-token] Meta error:", json);
      return new Response(
        JSON.stringify({
          success: false,
          error: json.error?.message || "Falha ao renovar token",
          details: json,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const newToken: string = json.access_token;
    const expiresIn: number = json.expires_in ?? 60 * 24 * 60 * 60; // default 60d
    const expiraEm = new Date(Date.now() + expiresIn * 1000).toISOString();

    // Upsert into system_api_credentials
    const { error: dbError } = await supabase
      .from("system_api_credentials")
      .upsert(
        {
          plataforma: "instagram",
          access_token: newToken,
          expiracao_token: expiraEm,
          status: "ativo",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "plataforma" }
      );

    if (dbError) {
      console.error("[refresh-instagram-token] DB error:", dbError);
      return new Response(
        JSON.stringify({ success: false, error: dbError.message }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[refresh-instagram-token] Token renovado. Expira em ${expiraEm}`);

    return new Response(
      JSON.stringify({
        success: true,
        expires_at: expiraEm,
        expires_in_days: Math.round(expiresIn / 86400),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[refresh-instagram-token] Error:", err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
