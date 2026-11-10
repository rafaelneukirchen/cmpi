import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PROJECT_URL = "https://unlophbeegjpmjfykmwk.supabase.co";
const DEFAULT_SEED_URL =
  `${PROJECT_URL}/storage/v1/object/public/app-assets/seeds/tse_votos.tsv.gz`;

const BATCH_SIZE = 2000;

function parseLine(line: string) {
  // Colunas: id, ano_eleicao, candidato_id, municipio, codigo_municipio, zona_eleitoral, total_votos
  const cols = line.split("\t");
  const [id, ano, cand, mun, cod, zona, votos] = cols;
  return {
    id,
    ano_eleicao: Number(ano),
    candidato_id: cand === "\\N" || !cand ? null : cand,
    municipio: mun,
    codigo_municipio: cod === "\\N" || !cod ? null : cod,
    zona_eleitoral: zona === "\\N" || !zona ? null : zona,
    total_votos: Number(votos || 0),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Parse body (opcional)
    let body: { year?: number; force?: boolean; seed_url?: string; cron?: boolean } = {};
    try {
      if (req.method === "POST") body = await req.json();
    } catch { /* ignore */ }

    const isCron = !!body.cron;

    // Verificar admin (exceto chamada interna de cron com service role)
    if (!isCron) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) throw new Error("Não autenticado");
      const caller = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await caller.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const { data: isAdmin } = await admin.rpc("has_role", {
        _user_id: user.id,
        _role: "admin",
      });
      if (!isAdmin) throw new Error("Apenas administradores podem importar dados TSE");
    }

    // Monta URL do seed
    let seedUrl = body.seed_url;
    if (!seedUrl) {
      if (body.year) {
        seedUrl = `${PROJECT_URL}/storage/v1/object/public/app-assets/seeds/tse_votos_${body.year}.tsv.gz`;
      } else {
        seedUrl = DEFAULT_SEED_URL;
      }
    }

    // Se ano específico, verifica se já temos esse ano carregado (a menos que force)
    if (body.year && !body.force) {
      const { count: existingYear } = await admin
        .from("tse_votos_municipio")
        .select("*", { count: "exact", head: true })
        .eq("ano_eleicao", body.year);
      if ((existingYear ?? 0) > 1000) {
        return new Response(
          JSON.stringify({
            success: true,
            skipped: true,
            message: `Ano ${body.year} já tem ${existingYear?.toLocaleString("pt-BR")} votos. Use "forçar" para reimportar.`,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    } else if (!body.year && !body.force) {
      // Comportamento legado: pula se já tem qualquer coisa
      const { count: existing } = await admin
        .from("tse_votos_municipio")
        .select("*", { count: "exact", head: true });
      if ((existing ?? 0) > 1000) {
        return new Response(
          JSON.stringify({
            success: true,
            skipped: true,
            message: `Tabela já contém ${existing?.toLocaleString("pt-BR")} votos. Use "forçar" para reimportar.`,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // Baixar e descompactar
    const resp = await fetch(seedUrl);
    if (!resp.ok) {
      // Cron: não é erro se o arquivo ainda não existe
      if (isCron && resp.status === 404) {
        return new Response(
          JSON.stringify({
            success: true,
            skipped: true,
            message: `Arquivo de seed para ${body.year ?? "padrão"} ainda não disponível (404). Aguardando upload.`,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      throw new Error(`Falha ao baixar seed (${seedUrl}): ${resp.status}`);
    }
    const compressed = new Uint8Array(await resp.arrayBuffer());
    const ds = new DecompressionStream("gzip");
    const stream = new Blob([compressed]).stream().pipeThrough(ds);
    const text = await new Response(stream).text();

    const lines = text.split("\n").filter((l) => l.length > 0);
    let inserted = 0;
    let errors = 0;

    for (let i = 0; i < lines.length; i += BATCH_SIZE) {
      const batch = lines.slice(i, i + BATCH_SIZE).map(parseLine);
      // Se force + year, podemos sobrescrever (upsert padrão sem ignoreDuplicates)
      const { error } = await admin
        .from("tse_votos_municipio")
        .upsert(batch, {
          onConflict: "id",
          ignoreDuplicates: !body.force,
        });
      if (error) {
        errors++;
        console.error(`Batch ${i}: ${error.message}`);
      } else {
        inserted += batch.length;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        year: body.year ?? null,
        seed_url: seedUrl,
        total_lines: lines.length,
        inserted,
        errors,
        message: `Importação concluída: ${inserted.toLocaleString("pt-BR")} votos processados${body.year ? ` (ano ${body.year})` : ""}.`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error(e);
    return new Response(
      JSON.stringify({ success: false, error: e.message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
