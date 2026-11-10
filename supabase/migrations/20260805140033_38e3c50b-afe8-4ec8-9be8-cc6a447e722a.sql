-- Exportação sem dados: somente estrutura e lógica.
CREATE OR REPLACE FUNCTION public.has_full_leads_access()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_permissions
    WHERE user_id = auth.uid() AND module = 'leads_full'
  );
$function$;
