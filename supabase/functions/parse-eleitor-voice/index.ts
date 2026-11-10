// Edge Function: parse-eleitor-voice
// Recebe uma transcrição de áudio em linguagem natural e devolve os campos
// estruturados do eleitor (nome, telefone, bairro, cidade, zona eleitoral, observações)
// usando o Lovable AI Gateway com tool-calling para garantir JSON válido.

import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface ParsedEleitor {
  nome_completo?: string;
  telefone?: string;
  bairro?: string;
  cidade_nome?: string;
  zona_eleitoral?: string;
  observacoes?: string;
}

async function requireAuth(req: Request, opts: { admin?: boolean } = {}) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return { error: "Unauthorized", status: 401 };
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data, error } = await sb.auth.getUser();
  if (error || !data?.user) return { error: "Unauthorized", status: 401 };
  if (opts.admin) {
    const { data: ok } = await sb.rpc("has_role", { _user_id: data.user.id, _role: "admin" });
    if (!ok) return { error: "Forbidden", status: 403 };
  }
  return { user: data.user };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = await requireAuth(req);
  if ("error" in auth) {
    return new Response(JSON.stringify({ success: false, error: auth.error }), {
      status: auth.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { transcript } = await req.json();
    if (typeof transcript !== "string" || transcript.trim().length < 2) {
      return new Response(
        JSON.stringify({ success: false, error: "Transcrição vazia." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (transcript.length > 4000) {
      return new Response(
        JSON.stringify({ success: false, error: "Transcrição muito longa." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: "LOVABLE_API_KEY não configurada." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `Você é um assistente que extrai dados cadastrais de eleitores a partir de transcrições de fala em português brasileiro coletadas em campo.
Regras:
- Retorne APENAS os campos que conseguir identificar com clareza. Se não tiver certeza, deixe em branco.
- "nome_completo": nome próprio da pessoa, com capitalização correta (ex: "João da Silva").
- "telefone": apenas dígitos, com DDD (ex: "11999998888"). Aceite formatos falados ("onze nove nove...").
- "bairro": nome do bairro, capitalizado.
- "cidade_nome": nome da cidade, capitalizado.
- "zona_eleitoral": apenas o número da zona (ex: "248").
- "observacoes": qualquer informação adicional relevante (ex: "tem três filhos", "vota no posto x"). NÃO repita os outros campos aqui.
- Ignore palavras de preenchimento ("ééé", "tipo", "então") e respostas evasivas ("não sei", "não lembro").`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Transcrição:\n"""${transcript.trim()}"""` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "registrar_eleitor",
              description: "Registra os dados estruturados do eleitor extraídos da fala.",
              parameters: {
                type: "object",
                properties: {
                  nome_completo: { type: "string", description: "Nome completo capitalizado." },
                  telefone: { type: "string", description: "Apenas dígitos, com DDD." },
                  bairro: { type: "string" },
                  cidade_nome: { type: "string" },
                  zona_eleitoral: { type: "string", description: "Apenas o número." },
                  observacoes: { type: "string" },
                },
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "registrar_eleitor" } },
      }),
    });

    if (aiResp.status === 429) {
      return new Response(
        JSON.stringify({ success: false, error: "Muitas requisições. Tente novamente em alguns segundos." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (aiResp.status === 402) {
      return new Response(
        JSON.stringify({ success: false, error: "Créditos da IA esgotados. Adicione créditos no workspace." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!aiResp.ok) {
      const txt = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, txt);
      return new Response(
        JSON.stringify({ success: false, error: "Falha na IA. Tente de novo." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await aiResp.json();
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    let parsed: ParsedEleitor = {};
    if (toolCall?.function?.arguments) {
      try {
        parsed = JSON.parse(toolCall.function.arguments);
      } catch (e) {
        console.error("JSON parse error:", e, toolCall.function.arguments);
      }
    }

    // Limpeza final: telefone só dígitos
    if (parsed.telefone) parsed.telefone = parsed.telefone.replace(/\D+/g, "");
    if (parsed.zona_eleitoral) parsed.zona_eleitoral = parsed.zona_eleitoral.replace(/\D+/g, "");

    return new Response(
      JSON.stringify({ success: true, data: parsed }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("parse-eleitor-voice error:", e);
    return new Response(
      JSON.stringify({ success: false, error: e instanceof Error ? e.message : "Erro desconhecido" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
