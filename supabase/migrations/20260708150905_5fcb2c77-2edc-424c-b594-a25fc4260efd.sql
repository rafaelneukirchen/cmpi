-- Exportação sem dados: somente estrutura e lógica.
DROP POLICY IF EXISTS planejamento_select ON public.planejamento_semanal;

CREATE POLICY planejamento_select ON public.planejamento_semanal
FOR SELECT USING (
  is_admin()
  OR cidade_id IS NULL
  OR user_can_access_cidade(cidade_id)
  OR criado_por_user_id = auth.uid()
  OR coordenador_user_id = auth.uid()
);
