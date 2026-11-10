-- Exportação sem dados: somente estrutura e lógica.
REVOKE EXECUTE ON FUNCTION public.get_captados_ranking_liderancas() FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.get_captados_ranking_liderancas() FROM anon;

GRANT EXECUTE ON FUNCTION public.get_captados_ranking_liderancas() TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_captados_ranking_liderancas() TO service_role;

REVOKE EXECUTE ON FUNCTION public.get_captados_ranking_coordenacao() FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION public.get_captados_ranking_coordenacao() FROM anon;

GRANT EXECUTE ON FUNCTION public.get_captados_ranking_coordenacao() TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_captados_ranking_coordenacao() TO service_role;
