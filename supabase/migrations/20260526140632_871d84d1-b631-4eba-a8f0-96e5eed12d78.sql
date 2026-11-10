-- Exportação sem dados: somente estrutura e lógica.
ALTER TABLE public.tse_candidatos DROP COLUMN IF EXISTS cpf;

DROP POLICY IF EXISTS audit_log_insert ON public.audit_log;

CREATE POLICY audit_log_insert ON public.audit_log
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

DROP POLICY IF EXISTS logistics_profiles_update ON public.logistics_profiles;

CREATE POLICY logistics_profiles_update ON public.logistics_profiles
  FOR UPDATE TO authenticated
  USING (is_admin() OR user_id = auth.uid());
