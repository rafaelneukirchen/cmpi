-- Exportação sem dados: somente estrutura e lógica.
CREATE OR REPLACE FUNCTION public.get_captados_ranking_coordenacao()
 RETURNS TABLE(user_id uuid, nome text, total bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH RECURSIVE coord_ids AS (
    SELECT ur.user_id
    FROM public.user_roles ur
    WHERE ur.role IN ('coordenador_estadual', 'coordenador_regional')
  ),
  coord_tree AS (
    SELECT c.user_id AS coord_id, c.user_id AS member_user_id
    FROM coord_ids c
    UNION
    SELECT ct.coord_id, em.user_id AS member_user_id
    FROM coord_tree ct
    JOIN public.equipe_membros em ON em.coordenador_user_id = ct.member_user_id
    WHERE em.user_id IS NOT NULL
  ),
  direct_user_totals AS (
    SELECT
      ct.coord_id,
      COUNT(DISTINCT e.id)::bigint AS total
    FROM coord_tree ct
    JOIN public.eleitores_captados e ON e.captado_por_user_id = ct.member_user_id
    GROUP BY ct.coord_id
  ),
  hierarchy_totals AS (
    SELECT
      h.coord_id,
      COUNT(DISTINCT h.captado_id)::bigint AS total
    FROM public.get_captados_hierarchy() h
    WHERE h.coord_id IS NOT NULL
    GROUP BY h.coord_id
  )
  SELECT
    c.user_id,
    COALESCE(p.nome, 'Coordenação') AS nome,
    GREATEST(COALESCE(dut.total, 0), COALESCE(ht.total, 0))::bigint AS total
  FROM coord_ids c
  LEFT JOIN public.profiles p ON p.user_id = c.user_id
  LEFT JOIN direct_user_totals dut ON dut.coord_id = c.user_id
  LEFT JOIN hierarchy_totals ht ON ht.coord_id = c.user_id
  WHERE GREATEST(COALESCE(dut.total, 0), COALESCE(ht.total, 0)) > 0
  ORDER BY total DESC, nome ASC;
$function$;
