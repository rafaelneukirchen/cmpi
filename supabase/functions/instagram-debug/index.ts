import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FB = "https://graph.facebook.com/v25.0";

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
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (!(await requireAdmin(req))) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const token = Deno.env.get("INSTAGRAM_ACCESS_TOKEN");
  if (!token) {
    return new Response(JSON.stringify({ error: "INSTAGRAM_ACCESS_TOKEN não configurado" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const out: Record<string, unknown> = {};

  try {
    // 1. Quem é o dono do token
    const me = await fetch(`${FB}/me?fields=id,name&access_token=${token}`).then(r => r.json());
    out.token_owner = me;

    // 2. Permissões concedidas
    const perms = await fetch(`${FB}/me/permissions?access_token=${token}`).then(r => r.json());
    out.permissions = perms;

    // 3. Páginas acessíveis + vínculo IG
    const pages = await fetch(
      `${FB}/me/accounts?fields=id,name,instagram_business_account{id,username,name},connected_instagram_account{id,username}&access_token=${token}`
    ).then(r => r.json());
    out.pages = pages;

    // 4. Tentativa direta
    const direct = await fetch(
      `${FB}/me?fields=accounts{id,name,instagram_business_account,connected_instagram_account}&access_token=${token}`
    ).then(r => r.json());
    out.direct_check = direct;
  } catch (e) {
    out.error = e instanceof Error ? e.message : String(e);
  }

  return new Response(JSON.stringify(out, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
