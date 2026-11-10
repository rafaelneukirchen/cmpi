-- Exportação sem dados: somente estrutura e lógica.
CREATE OR REPLACE FUNCTION public.can_access_planejamento(_criado uuid, _coord uuid, _lider uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin()
      OR _criado = auth.uid()
      OR _coord = auth.uid()
      OR (_lider IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.liderancas l
            WHERE l.id = _lider
              AND (l.coordenador_user_id = auth.uid()
                   OR EXISTS (SELECT 1 FROM public.profiles pr
                              WHERE pr.user_id = auth.uid()
                                AND pr.lideranca_vinculada_id = l.id))
          ))
      OR (_lider IS NULL AND _coord IS NULL AND _criado IS NULL AND public.is_admin());
$$;

DROP POLICY IF EXISTS planejamento_select ON public.planejamento_semanal;

CREATE POLICY planejamento_select ON public.planejamento_semanal
FOR SELECT TO authenticated
USING (public.can_access_planejamento(criado_por_user_id, coordenador_user_id, lideranca_id));

DROP POLICY IF EXISTS planejamento_update ON public.planejamento_semanal;

CREATE POLICY planejamento_update ON public.planejamento_semanal
FOR UPDATE TO authenticated
USING (public.is_admin() OR (public.user_has_campo_planejamento() AND (criado_por_user_id = auth.uid() OR coordenador_user_id = auth.uid())))
WITH CHECK (public.is_admin() OR public.user_has_campo_planejamento());

DROP POLICY IF EXISTS planejamento_delete ON public.planejamento_semanal;

CREATE POLICY planejamento_delete ON public.planejamento_semanal
FOR DELETE TO authenticated
USING (public.is_admin() OR (public.user_has_campo_planejamento() AND (criado_por_user_id = auth.uid() OR coordenador_user_id = auth.uid())));

DROP POLICY IF EXISTS acoes_pl_select ON public.acoes_planejadas;

CREATE POLICY acoes_pl_select ON public.acoes_planejadas
FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.planejamento_semanal p
  WHERE p.id = acoes_planejadas.planejamento_id
));
