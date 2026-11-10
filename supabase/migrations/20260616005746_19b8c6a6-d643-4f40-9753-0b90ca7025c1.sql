-- Exportação sem dados: somente estrutura e lógica.
CREATE OR REPLACE FUNCTION public.get_captados_ranking_coordenacao()
RETURNS TABLE(user_id uuid, nome text, total bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    em.coordenador_user_id AS user_id,
    COALESCE(pc.nome, 'Coordenação') AS nome,
    COUNT(*)::bigint AS total
  FROM public.eleitores_captados e
  JOIN public.equipe_membros em ON em.user_id = e.captado_por_user_id
  LEFT JOIN public.profiles pc ON pc.user_id = em.coordenador_user_id
  WHERE e.captado_por_user_id IS NOT NULL
    AND e.tipo_captador = 'usuario'
  GROUP BY em.coordenador_user_id, pc.nome
  ORDER BY total DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_captados_ranking_coordenacao() TO authenticated;
