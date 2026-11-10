-- Exportação sem dados: somente estrutura e lógica.
CREATE OR REPLACE FUNCTION public.get_captados_scope_for(_user_id uuid)
RETURNS TABLE(captado_id uuid, captador_user_id uuid, tipo_captador text, lider_id uuid, coord_id uuid)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH me AS (
    SELECT CASE WHEN public.is_admin() THEN COALESCE(_user_id, auth.uid()) ELSE auth.uid() END AS u
  ),
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
  WHERE (public.has_role(me.u, 'admin'::app_role))
     OR (h.captador_user_id IS NOT NULL AND h.captador_user_id = me.u)
     OR (h.coord_id IS NOT NULL AND h.coord_id IN (SELECT id FROM coord_set))
     OR (h.lider_id IS NOT NULL AND h.lider_id IN (SELECT id FROM meus_lideres));
$function$;

GRANT EXECUTE ON FUNCTION public.get_captados_scope_for(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_captados_total_for(_user_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COUNT(DISTINCT s.captado_id)::bigint
  FROM public.get_captados_scope_for(_user_id) s;
$function$;

GRANT EXECUTE ON FUNCTION public.get_captados_total_for(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_captados_ranking_for(_user_id uuid)
RETURNS TABLE(user_id uuid, nome text, total bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH s AS (SELECT * FROM public.get_captados_scope_for(_user_id))
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

GRANT EXECUTE ON FUNCTION public.get_captados_ranking_for(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_captados_ranking_liderancas_for(_user_id uuid)
RETURNS TABLE(user_id uuid, nome text, total bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH s AS (SELECT * FROM public.get_captados_scope_for(_user_id)),
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

GRANT EXECUTE ON FUNCTION public.get_captados_ranking_liderancas_for(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_captados_ranking_coordenacao_for(_user_id uuid)
RETURNS TABLE(user_id uuid, nome text, total bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH me AS (
    SELECT CASE WHEN public.is_admin() THEN COALESCE(_user_id, auth.uid()) ELSE auth.uid() END AS u
  ),
  s AS (SELECT * FROM public.get_captados_scope_for(_user_id)),
  agg AS (
    SELECT (SELECT u FROM me) AS coord_id, COUNT(DISTINCT s.captado_id)::bigint AS total
    FROM s
  )
  SELECT a.coord_id AS user_id,
         COALESCE(p.nome, 'Coordenação') AS nome,
         a.total
  FROM agg a
  LEFT JOIN public.profiles p ON p.user_id = a.coord_id
  WHERE a.total > 0 AND a.coord_id IS NOT NULL;
$function$;

GRANT EXECUTE ON FUNCTION public.get_captados_ranking_coordenacao_for(uuid) TO authenticated;
