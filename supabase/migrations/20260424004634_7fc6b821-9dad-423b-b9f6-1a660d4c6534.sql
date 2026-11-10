-- Exportação sem dados: somente estrutura e lógica.
DROP POLICY IF EXISTS audit_log_select ON public.audit_log;

CREATE POLICY audit_log_select ON public.audit_log
FOR SELECT TO authenticated
USING (
  public.is_admin()
  OR (
    public.user_has_financial_access()
    AND table_name IN ('financial_transactions', 'reimbursements', 'payment_schedule')
  )
);
