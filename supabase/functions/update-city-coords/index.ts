import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Hardcoded coordinates for all 645 SP municipalities from IBGE
// We'll fetch them from IBGE's centroides endpoint which returns all at once
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

    const { data: estado } = await supabase.from('estados').select('id').eq('sigla', 'SP').single();
    if (!estado) throw new Error('Estado SP não encontrado');

    // Get cities without coordinates
    const { data: citiesNoCoords } = await supabase
      .from('cidades')
      .select('id, nome')
      .eq('estado_id', estado.id)
      .is('latitude', null);

    if (!citiesNoCoords || citiesNoCoords.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'All cities already have coordinates', remaining: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch all SP municipality metadata with centroids from IBGE (single request)
    const metaRes = await fetch('https://servicodados.ibge.gov.br/api/v3/malhas/estados/35?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=municipio');
    const geoJson = await metaRes.json();

    // Build name->centroid map from GeoJSON features
    // Each feature has properties.codarea and geometry
    const ibgeRes = await fetch('https://servicodados.ibge.gov.br/api/v1/localidades/estados/35/municipios');
    const municipios = await ibgeRes.json();
    
    // Map IBGE code -> name
    const codeToName = new Map<string, string>();
    for (const m of municipios) {
      codeToName.set(String(m.id), m.nome);
    }

    // Calculate centroids from GeoJSON polygons
    const nameToCentroid = new Map<string, { lat: number; lng: number }>();
    
    if (geoJson?.features) {
      for (const feature of geoJson.features) {
        const code = feature.properties?.codarea;
        const name = codeToName.get(code);
        if (!name) continue;

        // Calculate centroid from geometry
        const coords = extractCoords(feature.geometry);
        if (coords.length > 0) {
          let sumLat = 0, sumLng = 0;
          for (const [lng, lat] of coords) {
            sumLat += lat;
            sumLng += lng;
          }
          nameToCentroid.set(name, {
            lat: sumLat / coords.length,
            lng: sumLng / coords.length,
          });
        }
      }
    }

    let updated = 0;
    for (const city of citiesNoCoords) {
      const centroid = nameToCentroid.get(city.nome);
      if (centroid) {
        const { error } = await supabase.from('cidades').update({
          latitude: centroid.lat,
          longitude: centroid.lng,
        }).eq('id', city.id);
        if (!error) updated++;
      }
    }

    const { count: remaining } = await supabase
      .from('cidades')
      .select('id', { count: 'exact', head: true })
      .eq('estado_id', estado.id)
      .is('latitude', null);

    return new Response(JSON.stringify({
      success: true,
      cities_without_coords: citiesNoCoords.length,
      geojson_features: geoJson?.features?.length || 0,
      centroids_found: nameToCentroid.size,
      updated,
      remaining: remaining || 0,
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

function extractCoords(geometry: any): number[][] {
  if (!geometry) return [];
  const coords: number[][] = [];
  
  function flatten(arr: any) {
    if (Array.isArray(arr) && arr.length === 2 && typeof arr[0] === 'number') {
      coords.push(arr);
    } else if (Array.isArray(arr)) {
      for (const item of arr) flatten(item);
    }
  }
  
  flatten(geometry.coordinates);
  // Sample every Nth point to keep it fast
  const step = Math.max(1, Math.floor(coords.length / 20));
  return coords.filter((_, i) => i % step === 0);
}
