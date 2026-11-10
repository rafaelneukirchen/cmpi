import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const API_VERSION = "v25.0";
const FB_BASE = `https://graph.facebook.com/${API_VERSION}`;

type Check = {
  id: string;
  label: string;
  status: "ok" | "error" | "warning" | "skipped";
  message: string;
  hint?: string;
  details?: any;
};

async function getCurrentToken(supabase: any): Promise<{ token: string | null; source: string }> {
  const { data } = await supabase
    .from("system_api_credentials")
    .select("access_token")
    .eq("plataforma", "instagram")
    .eq("status", "ativo")
    .maybeSingle();
  if (data?.access_token) return { token: data.access_token, source: "database" };
  const env = Deno.env.get("INSTAGRAM_ACCESS_TOKEN");
  if (env) return { token: env, source: "environment" };
  return { token: null, source: "none" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const checks: Check[] = [];
  let canAutoRenew = false;

  const APP_ID = Deno.env.get("META_APP_ID")?.trim();
  const APP_SECRET = Deno.env.get("META_APP_SECRET")?.trim();
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // 1. Check META_APP_ID
  if (!APP_ID) {
    checks.push({
      id: "app_id",
      label: "META_APP_ID configurado",
      status: "error",
      message: "Secret META_APP_ID não está configurado",
      hint: "Adicione o ID do app (15-16 dígitos) em Lovable Cloud → Secrets",
    });
  } else if (!/^\d{10,20}$/.test(APP_ID)) {
    checks.push({
      id: "app_id",
      label: "META_APP_ID configurado",
      status: "error",
      message: `Formato inválido (${APP_ID.length} caracteres). Esperado: apenas dígitos (10-20)`,
      hint: "Em developers.facebook.com → Seu App → Topo da página, copie apenas os números do App ID",
      details: { length: APP_ID.length, sample: APP_ID.substring(0, 4) + "..." + APP_ID.substring(APP_ID.length - 2) },
    });
  } else {
    checks.push({
      id: "app_id",
      label: "META_APP_ID configurado",
      status: "ok",
      message: `OK (${APP_ID.length} dígitos)`,
    });
  }

  // 2. Check META_APP_SECRET
  if (!APP_SECRET) {
    checks.push({
      id: "app_secret",
      label: "META_APP_SECRET configurado",
      status: "error",
      message: "Secret META_APP_SECRET não está configurado",
      hint: "Em developers.facebook.com → Seu App → Configurações → Básico → Chave Secreta",
    });
  } else if (!/^[a-f0-9]{32}$/i.test(APP_SECRET)) {
    checks.push({
      id: "app_secret",
      label: "META_APP_SECRET configurado",
      status: "warning",
      message: `Formato suspeito (${APP_SECRET.length} caracteres). Esperado: 32 caracteres hexadecimais`,
      hint: "A Chave Secreta tem exatamente 32 caracteres entre 0-9 e a-f. Não cole espaços nem aspas.",
      details: {
        length: APP_SECRET.length,
        hasUppercase: /[A-Z]/.test(APP_SECRET),
        hasNonHex: /[^a-fA-F0-9]/.test(APP_SECRET),
      },
    });
  } else {
    checks.push({
      id: "app_secret",
      label: "META_APP_SECRET configurado",
      status: "ok",
      message: `OK (32 caracteres hexadecimais)`,
    });
  }

  // 3. Check token presence
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { token, source } = await getCurrentToken(supabase);
  if (!token) {
    checks.push({
      id: "token_present",
      label: "Token de acesso disponível",
      status: "error",
      message: "Nenhum token encontrado nem no banco nem em INSTAGRAM_ACCESS_TOKEN",
    });
  } else {
    checks.push({
      id: "token_present",
      label: "Token de acesso disponível",
      status: "ok",
      message: `Token encontrado (origem: ${source}, ${token.length} caracteres, prefixo: ${token.substring(0, 4)}...)`,
    });
  }

  // 4. Validate APP_ID + APP_SECRET pair using app access token endpoint
  // Endpoint: GET /oauth/access_token?client_id=...&client_secret=...&grant_type=client_credentials
  // This ONLY succeeds if APP_ID and APP_SECRET match.
  if (APP_ID && APP_SECRET) {
    try {
      const u = new URL(`${FB_BASE}/oauth/access_token`);
      u.searchParams.set("client_id", APP_ID);
      u.searchParams.set("client_secret", APP_SECRET);
      u.searchParams.set("grant_type", "client_credentials");
      const r = await fetch(u.toString());
      const j = await r.json();
      if (!r.ok || j.error) {
        checks.push({
          id: "app_pair",
          label: "APP_ID + APP_SECRET combinam",
          status: "error",
          message: j.error?.message || "Falha ao validar par APP_ID/APP_SECRET",
          hint:
            "O Facebook rejeitou a combinação. Verifique se APP_ID e APP_SECRET pertencem ao MESMO app no developers.facebook.com. " +
            "Vá em Configurações → Básico do app correto e copie ambos novamente.",
          details: j.error,
        });
      } else if (j.access_token) {
        checks.push({
          id: "app_pair",
          label: "APP_ID + APP_SECRET combinam",
          status: "ok",
          message: "Par validado com sucesso pela Meta (app access token gerado)",
        });
      }
    } catch (err: any) {
      checks.push({
        id: "app_pair",
        label: "APP_ID + APP_SECRET combinam",
        status: "error",
        message: `Erro de rede ao validar: ${err?.message}`,
      });
    }
  } else {
    checks.push({
      id: "app_pair",
      label: "APP_ID + APP_SECRET combinam",
      status: "skipped",
      message: "Pulado — APP_ID ou APP_SECRET ausente",
    });
  }

  // 5. Validate the token itself via /me
  let tokenAppId: string | null = null;
  let tokenIsValid = false;
  if (token) {
    try {
      const r = await fetch(`${FB_BASE}/me?access_token=${encodeURIComponent(token)}`);
      const j = await r.json();
      if (!r.ok || j.error) {
        checks.push({
          id: "token_valid",
          label: "Token de acesso é válido",
          status: "error",
          message: j.error?.message || "Token inválido",
          hint:
            j.error?.code === 190
              ? "O token expirou ou foi revogado. Gere um novo no Graph API Explorer e atualize INSTAGRAM_ACCESS_TOKEN."
              : "Verifique se o token foi copiado corretamente.",
          details: j.error,
        });
      } else {
        tokenIsValid = true;
        checks.push({
          id: "token_valid",
          label: "Token de acesso é válido",
          status: "ok",
          message: `Token ativo (id=${j.id}${j.name ? `, nome=${j.name}` : ""})`,
        });
      }
    } catch (err: any) {
      checks.push({
        id: "token_valid",
        label: "Token de acesso é válido",
        status: "error",
        message: `Erro de rede: ${err?.message}`,
      });
    }
  }

  // 6. Inspect token to check if it belongs to the same APP_ID
  // Endpoint: GET /debug_token?input_token=TOKEN&access_token=APP_ID|APP_SECRET
  if (token && APP_ID && APP_SECRET && tokenIsValid) {
    try {
      const appAccessToken = `${APP_ID}|${APP_SECRET}`;
      const u = new URL(`${FB_BASE}/debug_token`);
      u.searchParams.set("input_token", token);
      u.searchParams.set("access_token", appAccessToken);
      const r = await fetch(u.toString());
      const j = await r.json();
      if (!r.ok || j.error || !j.data) {
        checks.push({
          id: "token_app_match",
          label: "Token pertence ao mesmo app (APP_ID)",
          status: "error",
          message: j.error?.message || "Não foi possível inspecionar o token",
          hint: "Verifique se o token foi gerado pelo MESMO app cujos APP_ID/APP_SECRET estão configurados.",
          details: j.error || j,
        });
      } else {
        tokenAppId = String(j.data.app_id || "");
        const matches = tokenAppId === APP_ID;
        const expiresAt = j.data.expires_at ? new Date(j.data.expires_at * 1000) : null;
        const dataAccessExpiresAt = j.data.data_access_expires_at
          ? new Date(j.data.data_access_expires_at * 1000)
          : null;
        const daysLeft = expiresAt
          ? Math.round((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          : null;

        if (matches) {
          checks.push({
            id: "token_app_match",
            label: "Token pertence ao mesmo app (APP_ID)",
            status: "ok",
            message:
              `Token vinculado ao app ${tokenAppId}` +
              (expiresAt
                ? ` — expira em ${expiresAt.toLocaleDateString("pt-BR")} (${daysLeft} dias)`
                : " — sem data de expiração"),
            details: {
              token_app_id: tokenAppId,
              configured_app_id: APP_ID,
              expires_at: expiresAt?.toISOString() ?? null,
              data_access_expires_at: dataAccessExpiresAt?.toISOString() ?? null,
              days_left: daysLeft,
              type: j.data.type,
              scopes: j.data.scopes,
            },
          });
          canAutoRenew = true;
        } else {
          checks.push({
            id: "token_app_match",
            label: "Token pertence ao mesmo app (APP_ID)",
            status: "error",
            message: `Incompatível! Token foi gerado pelo app ${tokenAppId}, mas META_APP_ID configurado é ${APP_ID}`,
            hint:
              "A renovação automática só funciona quando o token e os secrets pertencem ao MESMO app. " +
              `Atualize META_APP_ID para ${tokenAppId} (e o META_APP_SECRET correspondente), ou gere um novo token usando o app ${APP_ID}.`,
            details: {
              token_app_id: tokenAppId,
              configured_app_id: APP_ID,
            },
          });
        }
      }
    } catch (err: any) {
      checks.push({
        id: "token_app_match",
        label: "Token pertence ao mesmo app (APP_ID)",
        status: "error",
        message: `Erro de rede: ${err?.message}`,
      });
    }
  } else {
    checks.push({
      id: "token_app_match",
      label: "Token pertence ao mesmo app (APP_ID)",
      status: "skipped",
      message: "Pulado — pré-requisitos não atendidos",
    });
  }

  const summary = {
    can_auto_renew: canAutoRenew,
    total: checks.length,
    ok: checks.filter((c) => c.status === "ok").length,
    errors: checks.filter((c) => c.status === "error").length,
    warnings: checks.filter((c) => c.status === "warning").length,
  };

  return new Response(
    JSON.stringify({ success: true, summary, checks }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
