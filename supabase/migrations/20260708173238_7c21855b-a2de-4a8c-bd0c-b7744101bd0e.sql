-- Exportação sem dados: somente estrutura e lógica.
CREATE OR REPLACE FUNCTION public.get_captados_ranking_coordenacao()
 RETURNS TABLE(user_id uuid, nome text, total bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH coord_ids AS (
    SELECT ur.user_id
    FROM public.user_roles ur
    WHERE ur.role IN ('coordenador_estadual','coordenador_regional')
    UNION
    SELECT DISTINCT em.coordenador_user_id AS user_id
    FROM public.equipe_membros em
    WHERE em.coordenador_user_id IS NOT NULL
    UNION
    SELECT DISTINCT l.coordenador_user_id AS user_id
    FROM public.liderancas l
    WHERE l.coordenador_user_id IS NOT NULL
  ),
  captacoes AS (
    SELECT em.coordenador_user_id AS coord_id, e.id AS captado_id
    FROM public.eleitores_captados e
    JOIN public.equipe_membros em ON em.user_id = e.captado_por_user_id
    WHERE e.captado_por_user_id IS NOT NULL AND e.tipo_captador = 'usuario'
    UNION
    SELECT e.captado_por_user_id AS coord_id, e.id
    FROM public.eleitores_captados e
    WHERE e.tipo_captador = 'usuario'
      AND e.captado_por_user_id IN (SELECT user_id FROM coord_ids)
    UNION
    SELECT l.coordenador_user_id AS coord_id, e.id
    FROM public.eleitores_captados e
    JOIN public.liderancas l ON l.id = e.lideranca_id
    WHERE e.tipo_captador = 'lideranca' AND l.coordenador_user_id IS NOT NULL
    UNION
    -- captações por usuários que também são lideranças vinculadas ao coordenador
    SELECT l.coordenador_user_id AS coord_id, e.id
    FROM public.eleitores_captados e
    JOIN public.profiles p ON p.user_id = e.captado_por_user_id
    JOIN public.liderancas l ON l.coordenador_user_id IS NOT NULL
      AND (
        lower(trim(l.nome)) = lower(trim(p.nome))
        OR lower(trim(p.nome)) LIKE lower(trim(l.nome)) || ' %'
        OR lower(trim(l.nome)) LIKE lower(trim(p.nome)) || ' %'
        OR split_part(lower(trim(p.nome)),' ',1) = split_part(lower(trim(l.nome)),' ',1)
           AND split_part(lower(trim(p.nome)),' ',2) = split_part(lower(trim(l.nome)),' ',2)
      )
    WHERE e.tipo_captador = 'usuario' AND e.captado_por_user_id IS NOT NULL
  )
  SELECT
    c.user_id,
    COALESCE(p.nome, 'Coordenação') AS nome,
    COALESCE((SELECT COUNT(DISTINCT ca.captado_id) FROM captacoes ca WHERE ca.coord_id = c.user_id), 0)::bigint AS total
  FROM coord_ids c
  LEFT JOIN public.profiles p ON p.user_id = c.user_id
  ORDER BY total DESC, nome ASC;
$function$;
