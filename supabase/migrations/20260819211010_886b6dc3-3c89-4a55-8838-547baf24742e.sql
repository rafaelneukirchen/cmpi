-- Exportação sem dados: somente estrutura e lógica.
REVOKE EXECUTE ON FUNCTION public.get_conferencias_leads_por_dia(date, date) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_conferencias_leads_por_dia(date, date) TO authenticated;
