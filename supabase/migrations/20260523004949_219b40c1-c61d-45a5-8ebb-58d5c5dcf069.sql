-- Exportação sem dados: somente estrutura e lógica.
REVOKE ALL ON FUNCTION public.get_cidades_options() FROM PUBLIC;

REVOKE ALL ON FUNCTION public.get_cidades_options() FROM anon;

GRANT EXECUTE ON FUNCTION public.get_cidades_options() TO authenticated;
