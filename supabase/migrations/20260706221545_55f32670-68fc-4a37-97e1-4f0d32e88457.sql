-- Exportação sem dados: somente estrutura e lógica.
DROP POLICY IF EXISTS planejamento_delete ON public.planejamento_semanal;

CREATE POLICY planejamento_delete ON public.planejamento_semanal
  FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS planejamento_update ON public.planejamento_semanal;

CREATE POLICY planejamento_update ON public.planejamento_semanal
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS acoes_pl_delete ON public.acoes_planejadas;

CREATE POLICY acoes_pl_delete ON public.acoes_planejadas
  FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS acoes_pl_update ON public.acoes_planejadas;

CREATE POLICY acoes_pl_update ON public.acoes_planejadas
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP TRIGGER IF EXISTS trg_audit_planejamento_semanal ON public.planejamento_semanal;

CREATE TRIGGER trg_audit_planejamento_semanal
  AFTER INSERT OR UPDATE OR DELETE ON public.planejamento_semanal
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

DROP TRIGGER IF EXISTS trg_audit_acoes_planejadas ON public.acoes_planejadas;

CREATE TRIGGER trg_audit_acoes_planejadas
  AFTER INSERT OR UPDATE OR DELETE ON public.acoes_planejadas
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();
