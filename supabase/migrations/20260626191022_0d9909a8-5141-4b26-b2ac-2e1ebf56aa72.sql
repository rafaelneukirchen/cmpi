-- Exportação sem dados: somente estrutura e lógica.
CREATE OR REPLACE FUNCTION public.get_captados_total_coordenacao()
RETURNS bigint
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN public.is_admin() THEN (SELECT COUNT(*) FROM public.eleitores_captados)
    ELSE (
      SELECT COUNT(*) FROM public.eleitores_captados e
      WHERE
        -- captado pelo próprio coordenador
        (e.tipo_captador = 'usuario' AND e.captado_por_user_id = auth.uid())
        -- captado por membros da equipe do coordenador
        OR (e.tipo_captador = 'usuario' AND e.captado_por_user_id IN (
              SELECT em.user_id FROM public.equipe_membros em
              WHERE em.coordenador_user_id = auth.uid()
        ))
        -- captado via link de lideranças vinculadas ao coordenador
        OR (e.tipo_captador = 'lideranca' AND e.lideranca_id IN (
              SELECT l.id FROM public.liderancas l
              WHERE l.coordenador_user_id = auth.uid()
        ))
    )
  END::bigint;
$$;

GRANT EXECUTE ON FUNCTION public.get_captados_total_coordenacao() TO authenticated;
