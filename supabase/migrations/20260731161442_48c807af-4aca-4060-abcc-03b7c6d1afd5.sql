-- Exportação sem dados: somente estrutura e lógica.
CREATE OR REPLACE FUNCTION public.get_cidades_representantes()
RETURNS TABLE(
  cidade_id uuid,
  cidade_nome text,
  regiao_administrativa text,
  tem_coordenador boolean,
  tem_lider boolean,
  tem_cabo boolean,
  coordenador_ids uuid[],
  coordenador_nomes text[],
  lider_count bigint,
  cabo_count bigint
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  WITH lideres_por_cidade AS (
    SELECT
      c.id AS cidade_id,
      bool_or(l.coordenador_user_id IS NOT NULL) AS tem_coordenador_lider,
      array_agg(DISTINCT l.coordenador_user_id) FILTER (WHERE l.coordenador_user_id IS NOT NULL) AS coord_ids_lider,
      count(DISTINCT l.id) AS lider_count
    FROM public.cidades c
    LEFT JOIN public.liderancas l ON l.cidade_base_id = c.id OR c.id = ANY(COALESCE(l.cidades_representadas, ARRAY[]::uuid[]))
    GROUP BY c.id
  ),
  cabos_por_cidade AS (
    SELECT
      c.id AS cidade_id,
      bool_or(cb.coordenador_user_id IS NOT NULL) AS tem_coordenador_cabo,
      array_agg(DISTINCT cb.coordenador_user_id) FILTER (WHERE cb.coordenador_user_id IS NOT NULL) AS coord_ids_cabo,
      count(DISTINCT cb.id) AS cabo_count
    FROM public.cidades c
    LEFT JOIN public.liderancas l ON l.cidade_base_id = c.id OR c.id = ANY(COALESCE(l.cidades_representadas, ARRAY[]::uuid[]))
    LEFT JOIN public.cabos_eleitorais cb ON cb.lider_id = l.id OR cb.cidade_base_id = c.id
    GROUP BY c.id
  )
  SELECT
    c.id AS cidade_id,
    c.nome AS cidade_nome,
    c.regiao_administrativa,
    COALESCE(lc.tem_coordenador_lider, false) OR COALESCE(cb.tem_coordenador_cabo, false) AS tem_coordenador,
    COALESCE(lc.lider_count, 0) > 0 AS tem_lider,
    COALESCE(cb.cabo_count, 0) > 0 AS tem_cabo,
    (
      COALESCE(lc.coord_ids_lider, ARRAY[]::uuid[]) ||
      COALESCE(cb.coord_ids_cabo, ARRAY[]::uuid[])
    ) AS coordenador_ids,
    array_agg(DISTINCT p.nome) FILTER (WHERE p.nome IS NOT NULL) AS coordenador_nomes,
    COALESCE(lc.lider_count, 0) AS lider_count,
    COALESCE(cb.cabo_count, 0) AS cabo_count
  FROM public.cidades c
  LEFT JOIN lideres_por_cidade lc ON lc.cidade_id = c.id
  LEFT JOIN cabos_por_cidade cb ON cb.cidade_id = c.id
  LEFT JOIN public.profiles p ON p.user_id = ANY(
    COALESCE(lc.coord_ids_lider, ARRAY[]::uuid[]) ||
    COALESCE(cb.coord_ids_cabo, ARRAY[]::uuid[])
  )
  WHERE public.is_admin()
  GROUP BY c.id, c.nome, c.regiao_administrativa, lc.tem_coordenador_lider, lc.coord_ids_lider, lc.lider_count,
           cb.tem_coordenador_cabo, cb.coord_ids_cabo, cb.cabo_count
  ORDER BY c.nome;
$$;

GRANT EXECUTE ON FUNCTION public.get_cidades_representantes() TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_cidades_representantes() TO service_role;
