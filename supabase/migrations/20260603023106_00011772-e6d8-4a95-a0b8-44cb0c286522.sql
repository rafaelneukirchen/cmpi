-- Exportação sem dados: somente estrutura e lógica.
DROP POLICY IF EXISTS cidades_insert ON public.cidades;

CREATE POLICY cidades_insert
ON public.cidades
FOR INSERT
TO authenticated
WITH CHECK (is_admin());

DROP POLICY IF EXISTS agenda_campanha_insert ON public.agenda_campanha;

CREATE POLICY agenda_campanha_insert
ON public.agenda_campanha
FOR INSERT
TO authenticated
WITH CHECK (
  can_write()
  AND user_can_access_cidade(cidade_id)
  AND ((criado_por_user_id IS NULL) OR (criado_por_user_id = auth.uid()) OR is_admin())
);

DROP POLICY IF EXISTS liderancas_update ON public.liderancas;

CREATE POLICY liderancas_update
ON public.liderancas
FOR UPDATE
TO authenticated
USING (
  is_admin()
  OR (
    coordenador_user_id = auth.uid()
    AND (cidade_base_id IS NULL OR user_can_access_cidade(cidade_base_id))
  )
);
