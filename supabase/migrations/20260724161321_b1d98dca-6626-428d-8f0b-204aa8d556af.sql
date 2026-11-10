-- Exportação sem dados: somente estrutura e lógica.
CREATE OR REPLACE FUNCTION public.get_mapa_geral_cidades()
RETURNS TABLE(
  id uuid,
  nome text,
  regiao_administrativa text,
  latitude double precision,
  longitude double precision,
  cor text,
  tem_lideranca boolean,
  tem_dobradinha boolean,
  qtd_liderancas integer
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH lids_por_cidade AS (
    SELECT c.id AS cidade_id,
           COUNT(DISTINCT l.id)::int AS qtd,
           (
             SELECT l2.coordenador_user_id
             FROM public.liderancas l2
             WHERE (l2.cidade_base_id = c.id
                    OR c.id = ANY (COALESCE(l2.cidades_representadas, ARRAY[]::uuid[])))
               AND l2.coordenador_user_id IS NOT NULL
             GROUP BY l2.coordenador_user_id
             ORDER BY COUNT(*) DESC
             LIMIT 1
           ) AS coord_dominante
    FROM public.cidades c
    LEFT JOIN public.liderancas l
      ON (l.cidade_base_id = c.id
          OR c.id = ANY (COALESCE(l.cidades_representadas, ARRAY[]::uuid[])))
    GROUP BY c.id
  ),
  dobs AS (
    SELECT DISTINCT COALESCE(d.cidade_id, l.cidade_base_id) AS cidade_id
    FROM public.dobradinhas d
    LEFT JOIN public.liderancas l ON l.id = d.lideranca_id
    WHERE COALESCE(d.cidade_id, l.cidade_base_id) IS NOT NULL
  )
  SELECT
    c.id,
    c.nome,
    c.regiao_administrativa,
    c.latitude,
    c.longitude,
    COALESCE(c.coordenador_cor, p.cor) AS cor,
    (lp.qtd > 0) AS tem_lideranca,
    (dobs.cidade_id IS NOT NULL) AS tem_dobradinha,
    COALESCE(lp.qtd, 0) AS qtd_liderancas
  FROM public.cidades c
  LEFT JOIN lids_por_cidade lp ON lp.cidade_id = c.id
  LEFT JOIN public.profiles p ON p.user_id = lp.coord_dominante
  LEFT JOIN dobs ON dobs.cidade_id = c.id
  WHERE auth.uid() IS NOT NULL
  ORDER BY c.nome;
$$;

GRANT EXECUTE ON FUNCTION public.get_mapa_geral_cidades() TO authenticated;
