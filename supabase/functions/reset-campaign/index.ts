import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Ordem importa: filhas antes das pais
const TABLES_TO_WIPE = [
  // Captação / eleitores
  "eleitores_captados",
  // Logística
  "movements",
  "materials",
  "logistics_profiles",
  // Financeiro
  "reimbursements",
  "payment_schedule",
  "financial_transactions",
  // Eleitoral
  "dobradinhas",
  "projecao_votos",
  "visitas_campanha",
  "agenda_campanha",
  "estrutura_campanha",
  "liderancas",
  // Coordenação / equipe
  "contatos_coordenacao",
  "equipe_membros",
  "coordenador_cidades",
  // GPS / consentimento
  "user_locations",
  "user_location_consent",
  // Geografia
  "cidades",
  // Social (dados coletados)
  "social_metrics",
  "social_engagers",
  "social_discovery_profiles",
  "instagram_daily_snapshots",
  // Auditoria
  "audit_log",
  // Campanhas arquivadas
  "campanhas_arquivo",
  "campanhas",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verificar admin
    const authHeader = req.headers.get("Authorization")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) throw new Error("Não autenticado");

    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: caller.id,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Apenas administradores podem resetar o sistema");

    const results: Record<string, number | string> = {};

    // Apagar dados de todas as tabelas operacionais
    for (const tabela of TABLES_TO_WIPE) {
      const { error, count } = await supabase
        .from(tabela)
        .delete({ count: "exact" })
        .neq("id", "00000000-0000-0000-0000-000000000000");
      results[tabela] = error ? `erro: ${error.message}` : (count ?? 0);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Sistema zerado. Estrutura, usuários, identidade visual e integrações foram preservados.",
        details: results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
