-- Exportação sem dados: somente estrutura e lógica.
CREATE OR REPLACE FUNCTION public.get_captados_scope()
RETURNS TABLE(captado_id uuid, captador_user_id uuid, tipo_captador text, lider_id uuid, coord_id uuid)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH me AS (SELECT auth.uid() AS u),
  sub_coords AS (
    SELECT DISTINCT em.user_id
    FROM public.equipe_membros em, me
    WHERE em.coordenador_user_id = me.u AND em.user_id IS NOT NULL
  ),
  coord_set AS (
    SELECT u AS id FROM me WHERE u IS NOT NULL
    UNION
    SELECT user_id FROM sub_coords
  ),
  meus_lideres AS (
    SELECT l.id FROM public.liderancas l, me WHERE l.coordenador_user_id = me.u
    UNION
    SELECT p.lideranca_vinculada_id FROM public.profiles p, me
      WHERE p.user_id = me.u AND p.lideranca_vinculada_id IS NOT NULL
    UNION
    SELECT l.id FROM public.liderancas l
      WHERE l.coordenador_user_id IN (SELECT user_id FROM sub_coords)
  )
  SELECT h.captado_id, h.captador_user_id, h.tipo_captador, h.lider_id, h.coord_id
  FROM public.get_captados_hierarchy() h, me
  WHERE public.is_admin()
     OR (h.captador_user_id IS NOT NULL AND h.captador_user_id = me.u)
     OR (h.coord_id IS NOT NULL AND h.coord_id IN (SELECT id FROM coord_set))
     OR (h.lider_id IS NOT NULL AND h.lider_id IN (SELECT id FROM meus_lideres));
$function$;

GRANT EXECUTE ON FUNCTION public.get_captados_scope() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_captados_total()
RETURNS bigint
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN public.is_admin() THEN (SELECT COUNT(*) FROM public.eleitores_captados)
    ELSE (SELECT COUNT(DISTINCT s.captado_id) FROM public.get_captados_scope() s)
  END::bigint;
$function$;

CREATE OR REPLACE FUNCTION public.get_captados_total_coordenacao()
RETURNS bigint
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.get_captados_total();
$function$;

CREATE OR REPLACE FUNCTION public.get_captados_ranking()
RETURNS TABLE(user_id uuid, nome text, total bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH s AS (SELECT * FROM public.get_captados_scope())
  SELECT * FROM (
    SELECT
      s.captador_user_id AS user_id,
      COALESCE(p.nome, 'Usuário') AS nome,
      COUNT(DISTINCT s.captado_id)::bigint AS total
    FROM s
    LEFT JOIN public.profiles p ON p.user_id = s.captador_user_id
    WHERE s.captador_user_id IS NOT NULL
    GROUP BY s.captador_user_id, p.nome
    UNION ALL
    SELECT
      s.lider_id AS user_id,
      COALESCE(l.nome || ' (link público)', 'Link público') AS nome,
      COUNT(DISTINCT s.captado_id)::bigint AS total
    FROM s
    LEFT JOIN public.liderancas l ON l.id = s.lider_id
    WHERE s.captador_user_id IS NULL AND s.lider_id IS NOT NULL
    GROUP BY s.lider_id, l.nome
  ) x
  WHERE total > 0
  ORDER BY total DESC;
$function$;

CREATE OR REPLACE FUNCTION public.get_captados_ranking_liderancas()
RETURNS TABLE(user_id uuid, nome text, total bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH s AS (SELECT * FROM public.get_captados_scope()),
  explicit_liderancas AS (
    SELECT l.id AS entity_id, l.nome, COUNT(DISTINCT s.captado_id)::bigint AS total
    FROM public.liderancas l
    JOIN s ON s.lider_id = l.id
    GROUP BY l.id, l.nome
  ),
  operational_liderancas AS (
    SELECT p.user_id AS entity_id, COALESCE(p.nome, 'Liderança') AS nome,
           COUNT(DISTINCT s.captado_id)::bigint AS total
    FROM public.profiles p
    JOIN public.equipe_membros child ON child.coordenador_user_id = p.user_id
    JOIN s ON s.captador_user_id = p.user_id OR s.captador_user_id = child.user_id
    WHERE s.lider_id IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.liderancas l
        WHERE public.normalize_person_name(l.nome) = public.normalize_person_name(p.nome)
      )
    GROUP BY p.user_id, p.nome
  )
  SELECT entity_id AS user_id, nome, total FROM explicit_liderancas WHERE total > 0
  UNION ALL
  SELECT entity_id AS user_id, nome, total FROM operational_liderancas WHERE total > 0
  ORDER BY total DESC, nome ASC;
$function$;

CREATE OR REPLACE FUNCTION public.get_captados_ranking_coordenacao()
RETURNS TABLE(user_id uuid, nome text, total bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH s AS (SELECT * FROM public.get_captados_scope()),
  agg AS (
    SELECT
      CASE WHEN public.is_admin() THEN s.coord_id ELSE auth.uid() END AS coord_id,
      COUNT(DISTINCT s.captado_id)::bigint AS total
    FROM s
    WHERE public.is_admin() = false OR s.coord_id IS NOT NULL
    GROUP BY 1
  )
  SELECT a.coord_id AS user_id,
         COALESCE(p.nome, 'Coordenação') AS nome,
         a.total
  FROM agg a
  LEFT JOIN public.profiles p ON p.user_id = a.coord_id
  WHERE a.total > 0 AND a.coord_id IS NOT NULL
  ORDER BY a.total DESC, nome ASC;
$function$;
