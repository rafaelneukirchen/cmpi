-- Exportação sem dados: somente estrutura e lógica.
CREATE OR REPLACE FUNCTION public.get_captados_ranking_liderancas()
 RETURNS TABLE(user_id uuid, nome text, total bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH captacoes AS (
    -- Captações diretas atribuídas à liderança
    SELECT l.id AS lid, e.id AS captado_id
    FROM public.eleitores_captados e
    JOIN public.liderancas l ON l.id = e.lideranca_id
    WHERE e.tipo_captador = 'lideranca'
    UNION
    -- Captações por usuários vinculados a uma liderança (profiles.lideranca_vinculada_id)
    SELECT p.lideranca_vinculada_id AS lid, e.id
    FROM public.eleitores_captados e
    JOIN public.profiles p ON p.user_id = e.captado_por_user_id
    WHERE e.tipo_captador = 'usuario' AND p.lideranca_vinculada_id IS NOT NULL
    UNION
    -- Captações por usuários cujo nome corresponde ao de uma liderança
    SELECT l.id AS lid, e.id
    FROM public.eleitores_captados e
    JOIN public.profiles p ON p.user_id = e.captado_por_user_id
    JOIN public.liderancas l ON (
      lower(trim(l.nome)) = lower(trim(p.nome))
      OR (
        split_part(lower(trim(p.nome)),' ',1) = split_part(lower(trim(l.nome)),' ',1)
        AND split_part(lower(trim(p.nome)),' ',2) = split_part(lower(trim(l.nome)),' ',2)
        AND split_part(lower(trim(p.nome)),' ',2) <> ''
      )
    )
    WHERE e.tipo_captador = 'usuario' AND e.captado_por_user_id IS NOT NULL
  )
  SELECT
    l.id AS user_id,
    l.nome AS nome,
    COALESCE((SELECT COUNT(DISTINCT c.captado_id) FROM captacoes c WHERE c.lid = l.id), 0)::bigint AS total
  FROM public.liderancas l
  ORDER BY total DESC, l.nome ASC;
$function$;

GRANT EXECUTE ON FUNCTION public.get_captados_ranking_liderancas() TO authenticated, service_role;
