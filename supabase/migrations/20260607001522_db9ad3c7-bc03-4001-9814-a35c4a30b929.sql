-- Exportação sem dados: somente estrutura e lógica.
CREATE OR REPLACE FUNCTION public.get_public_map_data(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_link record;
  v_result jsonb;
BEGIN
  SELECT id, active, expires_at INTO v_link
  FROM public.public_map_links
  WHERE token = lower(trim(p_token))
  LIMIT 1;

  IF v_link.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Link inválido');
  END IF;
  IF NOT v_link.active THEN
    RETURN jsonb_build_object('success', false, 'error', 'Link desativado');
  END IF;
  IF v_link.expires_at IS NOT NULL AND v_link.expires_at < now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Link expirado');
  END IF;

  WITH cidades_data AS (
    SELECT
      c.id,
      c.nome,
      c.regiao_administrativa,
      c.latitude,
      c.longitude,
      c.coordenador_cor,
      c.coordenador_nome,
      (
        SELECT jsonb_agg(DISTINCT jsonb_build_object(
          'candidato_parceiro', d.candidato_parceiro,
          'cargo_parceiro', d.cargo_parceiro
        ))
        FROM public.dobradinhas d
        LEFT JOIN public.liderancas l ON l.id = d.lideranca_id
        WHERE COALESCE(d.cidade_id, l.cidade_base_id) = c.id
           OR (l.cidades_representadas IS NOT NULL AND c.id = ANY (l.cidades_representadas))
      ) AS dobradinhas,
      (
        SELECT jsonb_agg(jsonb_build_object(
          'nome', l.nome,
          'votos_estimados', COALESCE(l.votos_estimados, 0)
        ))
        FROM public.liderancas l
        WHERE l.cidade_base_id = c.id
           OR (l.cidades_representadas IS NOT NULL AND c.id = ANY (l.cidades_representadas))
      ) AS liderancas
    FROM public.cidades c
  )
  SELECT jsonb_build_object(
    'success', true,
    'cidades', COALESCE(jsonb_agg(to_jsonb(cidades_data)), '[]'::jsonb)
  ) INTO v_result
  FROM cidades_data;

  RETURN v_result;
END;
$function$;
