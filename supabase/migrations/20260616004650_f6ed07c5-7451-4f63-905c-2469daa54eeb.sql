-- Exportação sem dados: somente estrutura e lógica.
DROP POLICY IF EXISTS profiles_select ON public.profiles;

CREATE POLICY profiles_select ON public.profiles FOR SELECT
USING (user_id = auth.uid() OR public.is_admin() OR public.has_full_leads_access());
