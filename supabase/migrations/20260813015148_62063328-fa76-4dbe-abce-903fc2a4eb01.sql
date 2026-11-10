-- Exportação sem dados: somente estrutura e lógica.
CREATE OR REPLACE FUNCTION public.get_bairros_por_cidade()
RETURNS TABLE (
  cidade_id uuid,
  cidade_nome text,
  regiao_administrativa text,
  bairros text[],
  total_bairros integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH bairros_coletados AS (
    SELECT
      l.cidade_base_id AS cidade_id,
      unnest(l.bairros) AS bairro
    FROM public.liderancas l
    WHERE l.bairros IS NOT NULL
      AND array_length(l.bairros, 1) > 0
      AND l.cidade_base_id IS NOT NULL
    UNION
    SELECT
      cb.cidade_base_id AS cidade_id,
      unnest(cb.bairros) AS bairro
    FROM public.cabos_eleitorais cb
    WHERE cb.bairros IS NOT NULL
      AND array_length(cb.bairros, 1) > 0
      AND cb.cidade_base_id IS NOT NULL
    UNION
    SELECT
      e.cidade_id AS cidade_id,
      e.bairro AS bairro
    FROM public.eleitores_captados e
    WHERE e.bairro IS NOT NULL
      AND btrim(e.bairro) <> ''
      AND e.cidade_id IS NOT NULL
  ),
  bairros_normalizados AS (
    SELECT
      bc.cidade_id,
      lower(btrim(bc.bairro)) AS bairro_norm,
      min(bc.bairro) AS bairro_label
    FROM bairros_coletados bc
    GROUP BY bc.cidade_id, lower(btrim(bc.bairro))
  ),
  bairros_ordenados AS (
    SELECT
      bn.cidade_id,
      array_agg(bn.bairro_label ORDER BY bn.bairro_norm) AS bairros
    FROM bairros_normalizados bn
    GROUP BY bn.cidade_id
  )
  SELECT
    c.id AS cidade_id,
    c.nome AS cidade_nome,
    c.regiao_administrativa AS regiao_administrativa,
    coalesce(bo.bairros, ARRAY[]::text[]) AS bairros,
    coalesce(array_length(bo.bairros, 1), 0) AS total_bairros
  FROM public.cidades c
  LEFT JOIN bairros_ordenados bo ON bo.cidade_id = c.id
  WHERE bo.bairros IS NOT NULL
  ORDER BY c.nome;
$$;

REVOKE ALL ON FUNCTION public.get_bairros_por_cidade() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_bairros_por_cidade() TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_bairros_por_cidade() TO service_role;
