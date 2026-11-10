-- Exportação sem dados: somente estrutura e lógica.
DROP POLICY IF EXISTS planejamento_insert ON public.planejamento_semanal;

CREATE POLICY planejamento_insert ON public.planejamento_semanal
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS acoes_pl_insert ON public.acoes_planejadas;

CREATE POLICY acoes_pl_insert ON public.acoes_planejadas
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
