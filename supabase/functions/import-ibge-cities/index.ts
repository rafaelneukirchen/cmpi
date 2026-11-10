import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (!(await requireAdmin(req))) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { action } = await req.json().catch(() => ({ action: 'insert' }));

    // Get estado SP id
    const { data: estado } = await supabase.from('estados').select('id').eq('sigla', 'SP').single();
    if (!estado) throw new Error('Estado SP não encontrado');
    const estadoId = estado.id;

    if (action === 'coords') {
      // Phase 2: Update coordinates for cities missing them
      const { data: citiesNoCoords } = await supabase
        .from('cidades')
        .select('id, nome')
        .eq('estado_id', estadoId)
        .is('latitude', null)
        .limit(50); // Process 50 at a time

      let coordsUpdated = 0;
      if (citiesNoCoords && citiesNoCoords.length > 0) {
        for (const city of citiesNoCoords) {
          try {
            // Use Nominatim for geocoding
            const geoRes = await fetch(
              `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city.nome + ', São Paulo, Brazil')}&format=json&limit=1`,
              { headers: { 'User-Agent': 'InteligenciaEleitoral/1.0' } }
            );
            const geoData = await geoRes.json();
            if (geoData?.[0]) {
              await supabase.from('cidades').update({
                latitude: parseFloat(geoData[0].lat),
                longitude: parseFloat(geoData[0].lon),
              }).eq('id', city.id);
              coordsUpdated++;
            }
          } catch (e) {
            console.error(`Coords error for ${city.nome}:`, e);
          }
          // Respect rate limit
          await new Promise(r => setTimeout(r, 200));
        }
      }

      const { count: remaining } = await supabase
        .from('cidades')
        .select('id', { count: 'exact', head: true })
        .eq('estado_id', estadoId)
        .is('latitude', null);

      return new Response(JSON.stringify({
        success: true,
        action: 'coords',
        coords_updated: coordsUpdated,
        remaining: remaining || 0,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Phase 1: Insert all cities
    const { data: existing } = await supabase.from('cidades').select('nome').eq('estado_id', estadoId);
    const existingNames = new Set((existing || []).map(c => c.nome));

    const ibgeRes = await fetch('https://servicodados.ibge.gov.br/api/v1/localidades/estados/35/municipios?orderBy=nome');
    const municipios = await ibgeRes.json();

    // Get population
    let popMap = new Map<string, number>();
    try {
      const popRes = await fetch('https://servicodados.ibge.gov.br/api/v3/agregados/4714/periodos/2022/variaveis/93?localidades=N6[N3[35]]');
      const popData = await popRes.json();
      if (popData?.[0]?.resultados?.[0]?.series) {
        for (const serie of popData[0].resultados[0].series) {
          const code = serie.localidade?.id;
          const pop = parseInt(serie.serie?.['2022'] || '0');
          if (code && pop) popMap.set(code, pop);
        }
      }
    } catch (e) {
      console.error('Population fetch error:', e);
    }

    const newCities = [];
    for (const m of municipios) {
      if (existingNames.has(m.nome)) continue;
      const pop = popMap.get(String(m.id)) || 0;
      newCities.push({
        nome: m.nome,
        estado_id: estadoId,
        regiao_administrativa: m.microrregiao?.mesorregiao?.nome || null,
        populacao: pop,
        eleitores: Math.round(pop * 0.72),
      });
    }

    let inserted = 0;
    for (let i = 0; i < newCities.length; i += 100) {
      const batch = newCities.slice(i, i + 100);
      const { error } = await supabase.from('cidades').insert(batch);
      if (error) throw error;
      inserted += batch.length;
    }

    return new Response(JSON.stringify({
      success: true,
      action: 'insert',
      total_ibge: municipios.length,
      already_existing: existingNames.size,
      new_inserted: inserted,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
