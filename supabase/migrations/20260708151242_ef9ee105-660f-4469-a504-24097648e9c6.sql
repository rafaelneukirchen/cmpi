-- Exportação sem dados: somente estrutura e lógica.
CREATE OR REPLACE FUNCTION public.user_has_campo_planejamento()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.is_admin() OR EXISTS (
    SELECT 1 FROM public.user_permissions
    WHERE user_id = auth.uid() AND module = 'campo_planejamento'
  )
$$;

DROP POLICY IF EXISTS planejamento_select ON public.planejamento_semanal;

DROP POLICY IF EXISTS planejamento_insert ON public.planejamento_semanal;

DROP POLICY IF EXISTS planejamento_update ON public.planejamento_semanal;

DROP POLICY IF EXISTS planejamento_delete ON public.planejamento_semanal;

CREATE POLICY planejamento_select ON public.planejamento_semanal
FOR SELECT USING (
  is_admin()
  OR (user_has_campo_planejamento() AND (
    cidade_id IS NULL
    OR user_can_access_cidade(cidade_id)
    OR criado_por_user_id = auth.uid()
    OR coordenador_user_id = auth.uid()
  ))
);

CREATE POLICY planejamento_insert ON public.planejamento_semanal
FOR INSERT WITH CHECK (user_has_campo_planejamento());

CREATE POLICY planejamento_update ON public.planejamento_semanal
FOR UPDATE USING (user_has_campo_planejamento()) WITH CHECK (user_has_campo_planejamento());

CREATE POLICY planejamento_delete ON public.planejamento_semanal
FOR DELETE USING (user_has_campo_planejamento());

DROP POLICY IF EXISTS acoes_pl_select ON public.acoes_planejadas;

DROP POLICY IF EXISTS acoes_pl_insert ON public.acoes_planejadas;

DROP POLICY IF EXISTS acoes_pl_update ON public.acoes_planejadas;

DROP POLICY IF EXISTS acoes_pl_delete ON public.acoes_planejadas;

CREATE POLICY acoes_pl_select ON public.acoes_planejadas
FOR SELECT USING (
  is_admin() OR (user_has_campo_planejamento() AND EXISTS (
    SELECT 1 FROM public.planejamento_semanal p WHERE p.id = acoes_planejadas.planejamento_id
  ))
);

CREATE POLICY acoes_pl_insert ON public.acoes_planejadas
FOR INSERT WITH CHECK (user_has_campo_planejamento());

CREATE POLICY acoes_pl_update ON public.acoes_planejadas
FOR UPDATE USING (user_has_campo_planejamento()) WITH CHECK (user_has_campo_planejamento());

CREATE POLICY acoes_pl_delete ON public.acoes_planejadas
FOR DELETE USING (user_has_campo_planejamento());
