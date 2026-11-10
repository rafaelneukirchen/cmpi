-- Exportação sem dados: somente estrutura e lógica.
DROP POLICY IF EXISTS eleitores_captados_update ON public.eleitores_captados;

CREATE POLICY eleitores_captados_update
ON public.eleitores_captados
FOR UPDATE
TO authenticated
USING (
  is_admin()
  OR captado_por_user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.equipe_membros em
    WHERE em.coordenador_user_id = auth.uid()
      AND em.user_id = eleitores_captados.captado_por_user_id
  )
  OR EXISTS (
    SELECT 1 FROM public.liderancas l
    WHERE l.id = eleitores_captados.lideranca_id
      AND (
        l.coordenador_user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.coordenador_cidades cc
          WHERE cc.user_id = auth.uid()
            AND (cc.cidade_id = l.cidade_base_id OR cc.cidade_id = ANY (l.cidades_representadas))
        )
      )
  )
);

DROP POLICY IF EXISTS liderancas_update ON public.liderancas;

CREATE POLICY liderancas_update
ON public.liderancas
FOR UPDATE
TO authenticated
USING (is_admin() OR coordenador_user_id = auth.uid());

DROP POLICY IF EXISTS estrutura_campanha_insert ON public.estrutura_campanha;

CREATE POLICY estrutura_campanha_insert
ON public.estrutura_campanha
FOR INSERT
TO authenticated
WITH CHECK (can_write() AND user_can_access_cidade(cidade_id));

DROP POLICY IF EXISTS estrutura_campanha_update ON public.estrutura_campanha;

CREATE POLICY estrutura_campanha_update
ON public.estrutura_campanha
FOR UPDATE
TO authenticated
USING (can_write() AND user_can_access_cidade(cidade_id));

DROP POLICY IF EXISTS visitas_campanha_insert ON public.visitas_campanha;

CREATE POLICY visitas_campanha_insert
ON public.visitas_campanha
FOR INSERT
TO authenticated
WITH CHECK (can_write() AND user_can_access_cidade(cidade_id));

DROP POLICY IF EXISTS visitas_campanha_update ON public.visitas_campanha;

CREATE POLICY visitas_campanha_update
ON public.visitas_campanha
FOR UPDATE
TO authenticated
USING (can_write() AND user_can_access_cidade(cidade_id));
