-- Exportação sem dados: somente estrutura e lógica.
DROP POLICY IF EXISTS acoes_pl_insert ON public.acoes_planejadas;

DROP POLICY IF EXISTS acoes_pl_update ON public.acoes_planejadas;

DROP POLICY IF EXISTS acoes_pl_delete ON public.acoes_planejadas;

CREATE POLICY acoes_pl_insert ON public.acoes_planejadas
FOR INSERT TO authenticated
WITH CHECK (
  public.is_admin() OR (
    public.user_has_campo_planejamento()
    AND EXISTS (
      SELECT 1 FROM public.planejamento_semanal p
      WHERE p.id = planejamento_id
        AND public.can_access_planejamento(p.criado_por_user_id, p.coordenador_user_id, p.lideranca_id)
    )
  )
);

CREATE POLICY acoes_pl_update ON public.acoes_planejadas
FOR UPDATE TO authenticated
USING (
  public.is_admin() OR (
    public.user_has_campo_planejamento()
    AND EXISTS (
      SELECT 1 FROM public.planejamento_semanal p
      WHERE p.id = planejamento_id
        AND public.can_access_planejamento(p.criado_por_user_id, p.coordenador_user_id, p.lideranca_id)
    )
  )
)
WITH CHECK (
  public.is_admin() OR (
    public.user_has_campo_planejamento()
    AND EXISTS (
      SELECT 1 FROM public.planejamento_semanal p
      WHERE p.id = planejamento_id
        AND public.can_access_planejamento(p.criado_por_user_id, p.coordenador_user_id, p.lideranca_id)
    )
  )
);

CREATE POLICY acoes_pl_delete ON public.acoes_planejadas
FOR DELETE TO authenticated
USING (
  public.is_admin() OR (
    public.user_has_campo_planejamento()
    AND EXISTS (
      SELECT 1 FROM public.planejamento_semanal p
      WHERE p.id = planejamento_id
        AND public.can_access_planejamento(p.criado_por_user_id, p.coordenador_user_id, p.lideranca_id)
    )
  )
);
