-- Exportação sem dados: somente estrutura e lógica.
CREATE OR REPLACE FUNCTION public.has_full_leads_access()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT false;
$$;
