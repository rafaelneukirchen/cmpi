-- Exportação sem dados: somente estrutura e lógica.
CREATE OR REPLACE FUNCTION public.is_coordinator()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('coordenador_estadual','coordenador_regional')
  )
$$;

DROP POLICY IF EXISTS eleitores_captados_insert_auth ON public.eleitores_captados;

CREATE POLICY eleitores_captados_insert_auth ON public.eleitores_captados
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (
    is_admin()
    OR captado_por_user_id = auth.uid()
    OR (is_coordinator() AND ((cidade_id IS NULL) OR user_can_access_cidade(cidade_id)))
  )
);

DROP POLICY IF EXISTS eleitores_captados_update ON public.eleitores_captados;

CREATE POLICY eleitores_captados_update ON public.eleitores_captados
FOR UPDATE TO authenticated
USING (
  is_admin()
  OR captado_por_user_id = auth.uid()
  OR (is_coordinator() AND EXISTS (
        SELECT 1 FROM public.equipe_membros em
        WHERE em.coordenador_user_id = auth.uid()
          AND em.user_id = eleitores_captados.captado_por_user_id))
  OR (is_coordinator() AND EXISTS (
        SELECT 1 FROM public.liderancas l
        WHERE l.id = eleitores_captados.lideranca_id
          AND l.coordenador_user_id = auth.uid()))
)
WITH CHECK (
  is_admin()
  OR captado_por_user_id = auth.uid()
  OR (is_coordinator() AND EXISTS (
        SELECT 1 FROM public.equipe_membros em
        WHERE em.coordenador_user_id = auth.uid()
          AND em.user_id = eleitores_captados.captado_por_user_id))
  OR (is_coordinator() AND EXISTS (
        SELECT 1 FROM public.liderancas l
        WHERE l.id = eleitores_captados.lideranca_id
          AND l.coordenador_user_id = auth.uid()))
);

DROP POLICY IF EXISTS liderancas_insert ON public.liderancas;

CREATE POLICY liderancas_insert ON public.liderancas
FOR INSERT TO authenticated
WITH CHECK (is_admin() OR is_coordinator());

DROP POLICY IF EXISTS liderancas_update ON public.liderancas;

CREATE POLICY liderancas_update ON public.liderancas
FOR UPDATE TO authenticated
USING (is_admin() OR (is_coordinator() AND coordenador_user_id = auth.uid()))
WITH CHECK (is_admin() OR (is_coordinator() AND coordenador_user_id = auth.uid()));

DROP POLICY IF EXISTS cabos_insert_by_cidade ON public.cabos_eleitorais;

CREATE POLICY cabos_insert_by_cidade ON public.cabos_eleitorais
FOR INSERT TO authenticated
WITH CHECK (
  is_admin() OR (
    is_coordinator() AND EXISTS (
      SELECT 1 FROM public.liderancas l
      WHERE l.id = cabos_eleitorais.lider_id
        AND l.coordenador_user_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS cabos_update_by_cidade ON public.cabos_eleitorais;

CREATE POLICY cabos_update_by_cidade ON public.cabos_eleitorais
FOR UPDATE TO authenticated
USING (
  is_admin() OR (
    is_coordinator() AND EXISTS (
      SELECT 1 FROM public.liderancas l
      WHERE l.id = cabos_eleitorais.lider_id
        AND l.coordenador_user_id = auth.uid()
    )
  )
)
WITH CHECK (
  is_admin() OR (
    is_coordinator() AND EXISTS (
      SELECT 1 FROM public.liderancas l
      WHERE l.id = cabos_eleitorais.lider_id
        AND l.coordenador_user_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS cabos_delete_by_cidade ON public.cabos_eleitorais;

CREATE POLICY cabos_delete_by_cidade ON public.cabos_eleitorais
FOR DELETE TO authenticated
USING (
  is_admin() OR (
    is_coordinator() AND EXISTS (
      SELECT 1 FROM public.liderancas l
      WHERE l.id = cabos_eleitorais.lider_id
        AND l.coordenador_user_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS dobradinhas_insert ON public.dobradinhas;

CREATE POLICY dobradinhas_insert ON public.dobradinhas
FOR INSERT TO authenticated
WITH CHECK (
  is_admin() OR (
    is_coordinator() AND (
      lideranca_id IS NULL OR EXISTS (
        SELECT 1 FROM public.liderancas l
        WHERE l.id = dobradinhas.lideranca_id
          AND l.coordenador_user_id = auth.uid()
      )
    )
  )
);

DROP POLICY IF EXISTS dobradinhas_update ON public.dobradinhas;

CREATE POLICY dobradinhas_update ON public.dobradinhas
FOR UPDATE TO authenticated
USING (
  is_admin() OR (
    is_coordinator() AND (
      lideranca_id IS NULL OR EXISTS (
        SELECT 1 FROM public.liderancas l
        WHERE l.id = dobradinhas.lideranca_id
          AND l.coordenador_user_id = auth.uid()
      )
    )
  )
);

DROP POLICY IF EXISTS projecao_votos_insert ON public.projecao_votos;

CREATE POLICY projecao_votos_insert ON public.projecao_votos
FOR INSERT TO authenticated
WITH CHECK (is_admin() OR (is_coordinator() AND user_can_access_cidade(cidade_id)));

DROP POLICY IF EXISTS projecao_votos_update ON public.projecao_votos;

CREATE POLICY projecao_votos_update ON public.projecao_votos
FOR UPDATE TO authenticated
USING (is_admin() OR (is_coordinator() AND user_can_access_cidade(cidade_id)));

DROP POLICY IF EXISTS estrutura_campanha_insert ON public.estrutura_campanha;

CREATE POLICY estrutura_campanha_insert ON public.estrutura_campanha
FOR INSERT TO authenticated
WITH CHECK (is_admin() OR (is_coordinator() AND user_can_access_cidade(cidade_id)));

DROP POLICY IF EXISTS estrutura_campanha_update ON public.estrutura_campanha;

CREATE POLICY estrutura_campanha_update ON public.estrutura_campanha
FOR UPDATE TO authenticated
USING (is_admin() OR (is_coordinator() AND user_can_access_cidade(cidade_id)));

DROP POLICY IF EXISTS visitas_campanha_insert ON public.visitas_campanha;

CREATE POLICY visitas_campanha_insert ON public.visitas_campanha
FOR INSERT TO authenticated
WITH CHECK (is_admin() OR (is_coordinator() AND user_can_access_cidade(cidade_id)));

DROP POLICY IF EXISTS visitas_campanha_update ON public.visitas_campanha;

CREATE POLICY visitas_campanha_update ON public.visitas_campanha
FOR UPDATE TO authenticated
USING (is_admin() OR (is_coordinator() AND user_can_access_cidade(cidade_id)));

DROP POLICY IF EXISTS agenda_campanha_insert ON public.agenda_campanha;

CREATE POLICY agenda_campanha_insert ON public.agenda_campanha
FOR INSERT TO authenticated
WITH CHECK (
  (is_admin() OR is_coordinator())
  AND user_can_access_cidade(cidade_id)
  AND ((criado_por_user_id IS NULL) OR (criado_por_user_id = auth.uid()) OR is_admin())
);

DROP POLICY IF EXISTS agenda_campanha_update ON public.agenda_campanha;

CREATE POLICY agenda_campanha_update ON public.agenda_campanha
FOR UPDATE TO authenticated
USING (is_admin() OR (is_coordinator() AND criado_por_user_id = auth.uid()));

DROP POLICY IF EXISTS acoes_pl_insert ON public.acoes_planejadas;

CREATE POLICY acoes_pl_insert ON public.acoes_planejadas
FOR INSERT TO authenticated
WITH CHECK (is_admin() OR (is_coordinator() AND user_has_campo_planejamento()));

DROP POLICY IF EXISTS acoes_pl_update ON public.acoes_planejadas;

CREATE POLICY acoes_pl_update ON public.acoes_planejadas
FOR UPDATE TO authenticated
USING (is_admin() OR (is_coordinator() AND user_has_campo_planejamento()));

DROP POLICY IF EXISTS acoes_pl_delete ON public.acoes_planejadas;

CREATE POLICY acoes_pl_delete ON public.acoes_planejadas
FOR DELETE TO authenticated
USING (is_admin() OR (is_coordinator() AND user_has_campo_planejamento()));

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='materials') THEN
    EXECUTE 'DROP POLICY IF EXISTS materials_insert ON public.materials';
    EXECUTE 'DROP POLICY IF EXISTS materials_update ON public.materials';
    EXECUTE 'DROP POLICY IF EXISTS materials_delete ON public.materials';
  END IF;
END $$;

CREATE POLICY materials_insert ON public.materials
FOR INSERT TO authenticated WITH CHECK (is_admin() OR is_coordinator());

CREATE POLICY materials_update ON public.materials
FOR UPDATE TO authenticated USING (is_admin() OR is_coordinator());

CREATE POLICY materials_delete ON public.materials
FOR DELETE TO authenticated USING (is_admin() OR is_coordinator());

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='movements') THEN
    EXECUTE 'DROP POLICY IF EXISTS movements_insert ON public.movements';
    EXECUTE 'DROP POLICY IF EXISTS movements_update ON public.movements';
    EXECUTE 'DROP POLICY IF EXISTS movements_delete ON public.movements';
  END IF;
END $$;

CREATE POLICY movements_insert ON public.movements
FOR INSERT TO authenticated WITH CHECK (is_admin() OR is_coordinator());

CREATE POLICY movements_update ON public.movements
FOR UPDATE TO authenticated USING (is_admin() OR is_coordinator());

CREATE POLICY movements_delete ON public.movements
FOR DELETE TO authenticated USING (is_admin() OR is_coordinator());
