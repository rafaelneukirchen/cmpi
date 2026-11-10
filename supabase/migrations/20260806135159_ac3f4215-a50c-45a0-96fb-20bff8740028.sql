-- Exportação sem dados: somente estrutura e lógica.
CREATE OR REPLACE FUNCTION public.get_captados_ranking_coordenacao()
 RETURNS TABLE(user_id uuid, nome text, total bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH hierarchy_totals AS (
    SELECT h.coord_id, COUNT(DISTINCT h.captado_id)::bigint AS total
    FROM public.get_captados_hierarchy() h
    WHERE h.coord_id IS NOT NULL
    GROUP BY h.coord_id
  )
  SELECT
    ht.coord_id AS user_id,
    COALESCE(p.nome, 'Coordenação') AS nome,
    ht.total
  FROM hierarchy_totals ht
  LEFT JOIN public.profiles p ON p.user_id = ht.coord_id
  WHERE ht.total > 0
  ORDER BY ht.total DESC, nome ASC;
$function$;
