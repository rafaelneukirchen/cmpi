-- Exportação sem dados: somente estrutura e lógica.
CREATE OR REPLACE FUNCTION public.user_has_financial_access()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_permissions
    WHERE user_id = auth.uid() AND module = 'log_financeiro'
  )
$$;
