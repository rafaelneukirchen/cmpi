-- Exportação sem dados: somente estrutura e lógica.
CREATE OR REPLACE FUNCTION public.get_captados_ranking()
RETURNS TABLE(user_id uuid, nome text, total bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    e.captado_por_user_id AS user_id,
    COALESCE(p.nome, 'Usuário') AS nome,
    COUNT(*)::bigint AS total
  FROM public.eleitores_captados e
  LEFT JOIN public.profiles p ON p.user_id = e.captado_por_user_id
  WHERE e.captado_por_user_id IS NOT NULL
  GROUP BY e.captado_por_user_id, p.nome
  ORDER BY total DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_captados_ranking() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_captados_total()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::bigint FROM public.eleitores_captados;
$$;

GRANT EXECUTE ON FUNCTION public.get_captados_total() TO authenticated;
