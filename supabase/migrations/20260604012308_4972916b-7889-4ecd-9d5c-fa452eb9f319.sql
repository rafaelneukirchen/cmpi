-- Exportação sem dados: somente estrutura e lógica.
CREATE OR REPLACE FUNCTION public.get_cidades_options()
RETURNS TABLE(id uuid, nome text, regiao_administrativa text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT c.id, c.nome, c.regiao_administrativa
  FROM public.cidades c
  WHERE auth.uid() IS NOT NULL
  ORDER BY c.nome;
$function$;

REVOKE ALL ON FUNCTION public.get_cidades_options() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_cidades_options() TO authenticated, service_role;

DROP POLICY IF EXISTS dobradinhas_select ON public.dobradinhas;

CREATE POLICY dobradinhas_select ON public.dobradinhas
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS dobradinhas_insert ON public.dobradinhas;

CREATE POLICY dobradinhas_insert ON public.dobradinhas
  FOR INSERT TO authenticated
  WITH CHECK (public.can_write());

DROP POLICY IF EXISTS dobradinhas_update ON public.dobradinhas;

CREATE POLICY dobradinhas_update ON public.dobradinhas
  FOR UPDATE TO authenticated
  USING (public.can_write());

DROP POLICY IF EXISTS liderancas_insert ON public.liderancas;

CREATE POLICY liderancas_insert ON public.liderancas
  FOR INSERT TO authenticated
  WITH CHECK (public.can_write());

DROP POLICY IF EXISTS liderancas_update ON public.liderancas;

CREATE POLICY liderancas_update ON public.liderancas
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR (public.can_write() AND coordenador_user_id = auth.uid())
  );
