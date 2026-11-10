-- Exportação sem dados: somente estrutura e lógica.
DROP POLICY IF EXISTS profiles_update_admin ON public.profiles;

CREATE POLICY profiles_update_admin ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
