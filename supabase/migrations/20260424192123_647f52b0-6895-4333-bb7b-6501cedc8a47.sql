-- Exportação sem dados: somente estrutura e lógica.
DROP POLICY IF EXISTS liderancas_select ON public.liderancas;

CREATE POLICY liderancas_select
ON public.liderancas
FOR SELECT
TO authenticated
USING (
  public.is_admin()
  OR coordenador_user_id = auth.uid()
);
