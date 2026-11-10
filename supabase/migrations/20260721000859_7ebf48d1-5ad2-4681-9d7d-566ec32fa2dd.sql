-- Exportação sem dados: somente estrutura e lógica.
CREATE OR REPLACE FUNCTION public.get_captados_ranking_coordenacao()
 RETURNS TABLE(user_id uuid, nome text, total bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH coord_ids AS (
    SELECT ur.user_id FROM public.user_roles ur
    WHERE ur.role IN ('coordenador_estadual','coordenador_regional')
    UNION
    SELECT DISTINCT em.coordenador_user_id FROM public.equipe_membros em
    WHERE em.coordenador_user_id IS NOT NULL
    UNION
    SELECT DISTINCT l.coordenador_user_id FROM public.liderancas l
    WHERE l.coordenador_user_id IS NOT NULL
  ),
  -- Resolve each capture to a single coord via a priority chain
  resolved AS (
    SELECT
      e.id AS captado_id,
      COALESCE(
        -- 1) capture by lideranca → its coord
        (SELECT l.coordenador_user_id FROM public.liderancas l
          WHERE e.tipo_captador='lideranca' AND l.id = e.lideranca_id),
        -- 2) capture by user linked to a lideranca → lideranca's coord
        (SELECT l.coordenador_user_id FROM public.profiles p
          JOIN public.liderancas l ON l.id = p.lideranca_vinculada_id
          WHERE e.tipo_captador='usuario' AND p.user_id = e.captado_por_user_id),
        -- 3) capture by team member → coord of team
        (SELECT em.coordenador_user_id FROM public.equipe_membros em
          WHERE em.user_id = e.captado_por_user_id),
        -- 4) capture by the coord themselves
        (SELECT c.user_id FROM coord_ids c WHERE c.user_id = e.captado_por_user_id)
      ) AS coord_id
    FROM public.eleitores_captados e
  )
  SELECT
    c.user_id,
    COALESCE(p.nome, 'Coordenação') AS nome,
    COALESCE((SELECT COUNT(*) FROM resolved r WHERE r.coord_id = c.user_id), 0)::bigint AS total
  FROM coord_ids c
  LEFT JOIN public.profiles p ON p.user_id = c.user_id
  ORDER BY total DESC, nome ASC;
$function$;

CREATE OR REPLACE FUNCTION public.get_captados_ranking_liderancas()
 RETURNS TABLE(user_id uuid, nome text, total bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH resolved AS (
    SELECT
      e.id AS captado_id,
      COALESCE(
        -- 1) captação direta da liderança
        CASE WHEN e.tipo_captador='lideranca' THEN e.lideranca_id END,
        -- 2) captação por usuário vinculado à liderança
        (SELECT p.lideranca_vinculada_id FROM public.profiles p
          WHERE e.tipo_captador='usuario' AND p.user_id = e.captado_por_user_id
            AND p.lideranca_vinculada_id IS NOT NULL)
      ) AS lider_id
    FROM public.eleitores_captados e
  )
  SELECT
    l.id AS user_id,
    l.nome,
    COALESCE((SELECT COUNT(*) FROM resolved r WHERE r.lider_id = l.id), 0)::bigint AS total
  FROM public.liderancas l
  ORDER BY total DESC, l.nome ASC;
$function$;
