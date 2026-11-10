import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

async function requireAuth(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data, error } = await sb.auth.getUser();
  return !error && !!data?.user;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (!(await requireAuth(req))) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "IA não configurada", themes: [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { trends = [], questions = [], articles = [], location = "Brasil" } = await req.json();

    const prompt = `Você é um consultor de marketing político digital brasileiro, especialista em redes sociais e estratégia eleitoral. Com base nos dados abaixo sobre "${location}", analise o cenário e sugira exatamente 3 temas práticos.

TENDÊNCIAS DO MOMENTO (Google Trends):
${trends.length > 0 ? trends.map((t: any) => `- ${t.title} (${t.traffic || "em alta"})`).join("\n") : "- Sem dados disponíveis"}

DÚVIDAS DA POPULAÇÃO (buscas frequentes):
${questions.length > 0 ? questions.map((q: any) => `- ${q.question}`).join("\n") : "- Sem dados disponíveis"}

NOTÍCIAS RECENTES:
${articles.length > 0 ? articles.slice(0, 6).map((a: any) => `- ${a.title}`).join("\n") : "- Sem dados disponíveis"}

Para cada tema, forneça em JSON:
[
  {
    "titulo": "Título curto e direto do tema",
    "justificativa": "Por que esse tema está em alta e por que é estratégico para conquistar eleitores. Cite dados das tendências ou notícias acima.",
    "como_abordar": "Dica prática de como abordar o tema em vídeo ou post para redes sociais. Inclua sugestão de tom (informativo, emocional, propositivo), formato ideal (reels, stories, vídeo longo) e uma frase de abertura sugerida.",
    "hashtags": "#hashtag1 #hashtag2 #hashtag3"
  }
]

REGRAS:
- Foque em temas que geram engajamento nas redes sociais (Instagram, TikTok, YouTube).
- Sugira abordagens que demonstrem proximidade com o povo e propostas concretas.
- Evite polêmicas partidárias diretas; foque em problemas reais da população.
- Responda APENAS o JSON, sem markdown.`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
      }),
    });

    const aiData = await aiResp.json();
    const content = aiData.choices?.[0]?.message?.content || "[]";

    let themes;
    try {
      themes = JSON.parse(content.replace(/```json?\n?/g, "").replace(/```/g, "").trim());
    } catch {
      themes = [{ titulo: "Erro ao processar", justificativa: content, como_abordar: "", hashtags: "" }];
    }

    return new Response(
      JSON.stringify({ themes }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Theme generation error:", err);
    return new Response(
      JSON.stringify({ error: String(err), themes: [] }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
