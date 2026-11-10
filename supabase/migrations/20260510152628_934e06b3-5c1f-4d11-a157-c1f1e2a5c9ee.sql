-- Exportação sem dados: somente estrutura e lógica.
REVOKE EXECUTE ON FUNCTION public.get_captados_ranking() FROM anon, public;

REVOKE EXECUTE ON FUNCTION public.get_captados_total() FROM anon, public;

GRANT EXECUTE ON FUNCTION public.get_captados_ranking() TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_captados_total() TO authenticated;
