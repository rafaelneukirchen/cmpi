-- Exportação sem dados: somente estrutura e lógica.
CREATE OR REPLACE FUNCTION public.get_cidades_options()
RETURNS TABLE(id uuid, nome text, regiao_administrativa text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT c.id, c.nome, c.regiao_administrativa
  FROM public.cidades c
  WHERE
    public.is_admin()
    OR public.has_role(auth.uid(), 'coordenador_estadual')
    OR public.has_role(auth.uid(), 'operador_cadastro')
    OR EXISTS (
      SELECT 1
      FROM public.coordenador_cidades cc
      WHERE cc.user_id = auth.uid()
        AND cc.cidade_id = c.id
    )
  ORDER BY c.nome;
$function$;

REVOKE ALL ON FUNCTION public.get_cidades_options() FROM PUBLIC;

REVOKE ALL ON FUNCTION public.get_cidades_options() FROM anon;

GRANT EXECUTE ON FUNCTION public.get_cidades_options() TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_cidades_options() TO service_role;

DROP POLICY IF EXISTS dobradinhas_select ON public.dobradinhas;

DROP POLICY IF EXISTS "dobradinhas_select" ON public.dobradinhas;

CREATE POLICY dobradinhas_select
ON public.dobradinhas
FOR SELECT
TO authenticated
USING (
  public.is_admin()
  OR cidade_id IS NULL
  OR public.user_can_access_cidade(cidade_id)
  OR EXISTS (
    SELECT 1
    FROM public.liderancas l
    WHERE l.id = dobradinhas.lideranca_id
      AND (
        l.coordenador_user_id = auth.uid()
        OR (l.cidade_base_id IS NOT NULL AND public.user_can_access_cidade(l.cidade_base_id))
        OR EXISTS (
          SELECT 1
          FROM public.coordenador_cidades cc
          WHERE cc.user_id = auth.uid()
            AND cc.cidade_id = ANY(l.cidades_representadas)
        )
      )
  )
);
