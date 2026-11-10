-- Exportação sem dados: somente estrutura e lógica.
CREATE OR REPLACE FUNCTION public.get_captados_ranking()
RETURNS TABLE(user_id uuid, nome text, total bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM (
    SELECT
      e.captado_por_user_id AS user_id,
      COALESCE(p.nome, 'Usuário') AS nome,
      COUNT(*)::bigint AS total
    FROM public.eleitores_captados e
    LEFT JOIN public.profiles p ON p.user_id = e.captado_por_user_id
    WHERE e.captado_por_user_id IS NOT NULL
    GROUP BY e.captado_por_user_id, p.nome
    UNION ALL
    SELECT
      e.lideranca_id AS user_id,
      COALESCE(l.nome || ' (link público)', 'Link público') AS nome,
      COUNT(*)::bigint AS total
    FROM public.eleitores_captados e
    LEFT JOIN public.liderancas l ON l.id = e.lideranca_id
    WHERE e.captado_por_user_id IS NULL AND e.lideranca_id IS NOT NULL
    GROUP BY e.lideranca_id, l.nome
  ) x
  ORDER BY total DESC;
$$;
