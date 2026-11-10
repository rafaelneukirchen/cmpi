-- Exportação sem dados: somente estrutura e lógica.
DROP POLICY IF EXISTS acoes_ex_delete ON public.acoes_execucao;

CREATE POLICY acoes_ex_delete ON public.acoes_execucao
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR public.has_role(auth.uid(), 'coordenador_estadual')
    OR public.has_role(auth.uid(), 'coordenador_regional')
  );

DROP TRIGGER IF EXISTS audit_acoes_execucao ON public.acoes_execucao;

CREATE TRIGGER audit_acoes_execucao
  AFTER INSERT OR UPDATE OR DELETE ON public.acoes_execucao
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();
