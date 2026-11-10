-- Exportação sem dados: somente estrutura e lógica.
DROP POLICY IF EXISTS eleitores_captados_insert_auth ON public.eleitores_captados;

CREATE POLICY eleitores_captados_insert_auth
ON public.eleitores_captados
FOR INSERT
TO authenticated
WITH CHECK (
  can_write()
  AND (cidade_id IS NULL OR user_can_access_cidade(cidade_id))
  AND (
    lideranca_id IS NULL
    OR is_admin()
    OR EXISTS (
      SELECT 1 FROM public.liderancas l
      WHERE l.id = lideranca_id
        AND (
          l.coordenador_user_id = auth.uid()
          OR (l.cidade_base_id IS NOT NULL AND user_can_access_cidade(l.cidade_base_id))
        )
    )
  )
);

DROP POLICY IF EXISTS liderancas_select ON public.liderancas;

CREATE POLICY liderancas_select
ON public.liderancas
FOR SELECT
TO authenticated
USING (
  is_admin()
  OR coordenador_user_id = auth.uid()
  OR (cidade_base_id IS NOT NULL AND user_can_access_cidade(cidade_base_id))
);

DROP POLICY IF EXISTS user_locations_no_update ON public.user_locations;

CREATE POLICY user_locations_no_update
ON public.user_locations
FOR UPDATE
TO authenticated
USING (false)
WITH CHECK (false);
