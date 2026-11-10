-- Exportação sem dados: somente estrutura e lógica.
CREATE OR REPLACE FUNCTION public.user_has_financial_access()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.user_permissions
      WHERE user_id = auth.uid() AND module = 'log_financeiro'
    )
$$;

DROP POLICY IF EXISTS "financial_transactions_select" ON public.financial_transactions;

CREATE POLICY "financial_transactions_select"
  ON public.financial_transactions FOR SELECT TO authenticated
  USING (public.user_has_financial_access());

DROP POLICY IF EXISTS "reimbursements_select" ON public.reimbursements;

CREATE POLICY "reimbursements_select"
  ON public.reimbursements FOR SELECT TO authenticated
  USING (public.user_has_financial_access());

DROP POLICY IF EXISTS "payment_schedule_select" ON public.payment_schedule;

CREATE POLICY "payment_schedule_select"
  ON public.payment_schedule FOR SELECT TO authenticated
  USING (public.user_has_financial_access());

DROP POLICY IF EXISTS "financial_transactions_insert" ON public.financial_transactions;

CREATE POLICY "financial_transactions_insert"
  ON public.financial_transactions FOR INSERT TO authenticated
  WITH CHECK (public.user_has_financial_access() AND public.can_write());

DROP POLICY IF EXISTS "financial_transactions_update" ON public.financial_transactions;

CREATE POLICY "financial_transactions_update"
  ON public.financial_transactions FOR UPDATE TO authenticated
  USING (public.user_has_financial_access() AND public.can_write());

DROP POLICY IF EXISTS "reimbursements_insert" ON public.reimbursements;

CREATE POLICY "reimbursements_insert"
  ON public.reimbursements FOR INSERT TO authenticated
  WITH CHECK (public.user_has_financial_access() AND public.can_write());

DROP POLICY IF EXISTS "reimbursements_update" ON public.reimbursements;

CREATE POLICY "reimbursements_update"
  ON public.reimbursements FOR UPDATE TO authenticated
  USING (public.user_has_financial_access() AND public.can_write());

DROP POLICY IF EXISTS "payment_schedule_insert" ON public.payment_schedule;

CREATE POLICY "payment_schedule_insert"
  ON public.payment_schedule FOR INSERT TO authenticated
  WITH CHECK (public.user_has_financial_access() AND public.can_write());

DROP POLICY IF EXISTS "payment_schedule_update" ON public.payment_schedule;

CREATE POLICY "payment_schedule_update"
  ON public.payment_schedule FOR UPDATE TO authenticated
  USING (public.user_has_financial_access() AND public.can_write());
