-- Exportação sem dados: somente estrutura e lógica.
CREATE OR REPLACE FUNCTION public.get_captados_ranking_liderancas()
RETURNS TABLE(user_id uuid, nome text, total bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH explicit_liderancas AS (
    SELECT
      l.id AS entity_id,
      l.nome,
      COUNT(DISTINCT h.captado_id)::bigint AS total
    FROM public.liderancas l
    LEFT JOIN public.get_captados_hierarchy() h ON h.lider_id = l.id
    GROUP BY l.id, l.nome
  ),
  operational_liderancas AS (
    SELECT
      p.user_id AS entity_id,
      COALESCE(p.nome, 'Liderança') AS nome,
      COUNT(DISTINCT e.id)::bigint AS total
    FROM public.profiles p
    JOIN public.equipe_membros child ON child.coordenador_user_id = p.user_id
    JOIN public.eleitores_captados e ON e.captado_por_user_id = p.user_id
      OR e.captado_por_user_id = child.user_id
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.liderancas l
      WHERE public.normalize_person_name(l.nome) = public.normalize_person_name(p.nome)
    )
    GROUP BY p.user_id, p.nome
  )
  SELECT entity_id AS user_id, nome, total
  FROM explicit_liderancas
  WHERE total > 0
  UNION ALL
  SELECT entity_id AS user_id, nome, total
  FROM operational_liderancas
  WHERE total > 0
  ORDER BY total DESC, nome ASC;
$function$;

CREATE OR REPLACE FUNCTION public.get_captados_ranking_coordenacao()
RETURNS TABLE(user_id uuid, nome text, total bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH coord_ids AS (
    SELECT ur.user_id
    FROM public.user_roles ur
    WHERE ur.role IN ('coordenador_estadual', 'coordenador_regional')
    UNION
    SELECT DISTINCT em.coordenador_user_id
    FROM public.equipe_membros em
    WHERE em.coordenador_user_id IS NOT NULL
    UNION
    SELECT DISTINCT l.coordenador_user_id
    FROM public.liderancas l
    WHERE l.coordenador_user_id IS NOT NULL
    UNION
    SELECT DISTINCT c.coordenador_user_id
    FROM public.cabos_eleitorais c
    WHERE c.coordenador_user_id IS NOT NULL
  ),
  coord_tree AS (
    SELECT c.user_id AS coord_id, c.user_id AS member_user_id
    FROM coord_ids c
    UNION
    SELECT c.user_id AS coord_id, em.user_id AS member_user_id
    FROM coord_ids c
    JOIN public.equipe_membros em ON em.coordenador_user_id = c.user_id
    WHERE em.user_id IS NOT NULL
    UNION
    SELECT c.user_id AS coord_id, em2.user_id AS member_user_id
    FROM coord_ids c
    JOIN public.equipe_membros em1 ON em1.coordenador_user_id = c.user_id
    JOIN public.equipe_membros em2 ON em2.coordenador_user_id = em1.user_id
    WHERE em2.user_id IS NOT NULL
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
