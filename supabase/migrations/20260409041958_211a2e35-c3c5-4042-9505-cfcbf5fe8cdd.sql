-- Exportação sem dados: somente estrutura e lógica.
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() = 'b42bdfd7-26d3-4f0b-814b-766a29c9deaa'::uuid
$$;
