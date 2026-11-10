// Receives leads forwarded from clone projects' DB triggers.
// Public endpoint (no JWT). Validates `license_key` against the licencas table.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const {
      license_key, app_url, origem_lead_id, nome_completo, telefone,
      bairro, cidade_nome, zona_eleitoral, tipo_captador, captador_nome,
      latitude, longitude, captured_at,
    } = body ?? {};

    if (!license_key || !nome_completo) {
      return new Response(
        JSON.stringify({ success: false, error: "license_key e nome_completo são obrigatórios" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Valida que a licença existe e está ativa
    const { data: lic } = await admin
      .from("licencas")
      .select("chave_licenca, cliente_nome, status")
      .eq("chave_licenca", license_key)
      .maybeSingle();

    if (!lic) {
      return new Response(
        JSON.stringify({ success: false, error: "Licença não reconhecida" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { error } = await admin.from("leads_centralizados").upsert(
      {
        chave_licenca: license_key,
        cliente_nome: lic.cliente_nome,
        url_origem: app_url ?? null,
        origem_lead_id: origem_lead_id ?? null,
        nome_completo: String(nome_completo).trim(),
        telefone: telefone ?? null,
        bairro: bairro ?? null,
        cidade_nome: cidade_nome ?? null,
        zona_eleitoral: zona_eleitoral ?? null,
        tipo_captador: tipo_captador ?? null,
        captador_nome: captador_nome ?? null,
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        captured_at: captured_at ?? new Date().toISOString(),
        raw_payload: body,
      },
      { onConflict: "chave_licenca,origem_lead_id", ignoreDuplicates: false },
    );

    if (error) {
      console.error("insert error", error);
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(
      JSON.stringify({ success: false, error: (e as Error).message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
