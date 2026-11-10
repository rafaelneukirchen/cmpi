-- Exportação sem dados: somente estrutura e lógica.
CREATE OR REPLACE FUNCTION public.get_cidades_options()
RETURNS TABLE (
  id uuid,
  nome text,
  regiao_administrativa text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.nome, c.regiao_administrativa
  FROM public.cidades c
  WHERE public.can_write()
  ORDER BY c.nome;
$$;

GRANT EXECUTE ON FUNCTION public.get_cidades_options() TO authenticated;
