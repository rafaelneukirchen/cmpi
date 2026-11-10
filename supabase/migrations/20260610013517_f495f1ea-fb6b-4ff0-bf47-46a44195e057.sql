-- Exportação sem dados: somente estrutura e lógica.
DROP POLICY IF EXISTS "acoes_execucao_select" ON public.acoes_execucao;

CREATE POLICY "acoes_execucao_select" ON public.acoes_execucao FOR SELECT
USING (
  public.is_admin()
  OR iniciado_por_user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.equipe_membros em
    WHERE em.user_id = acoes_execucao.iniciado_por_user_id
      AND em.coordenador_user_id = auth.uid()
  )
);
