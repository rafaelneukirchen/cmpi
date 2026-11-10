-- Exportação sem dados: somente estrutura e lógica.
DROP POLICY IF EXISTS cidades_update ON public.cidades;

CREATE POLICY cidades_update ON public.cidades
  FOR UPDATE TO authenticated
  USING (can_write() AND user_can_access_cidade(id));

DROP POLICY IF EXISTS dobradinhas_insert ON public.dobradinhas;

CREATE POLICY dobradinhas_insert ON public.dobradinhas
  FOR INSERT TO authenticated
  WITH CHECK (
    can_write()
    AND (cidade_id IS NULL OR user_can_access_cidade(cidade_id))
  );

DROP POLICY IF EXISTS dobradinhas_update ON public.dobradinhas;

CREATE POLICY dobradinhas_update ON public.dobradinhas
  FOR UPDATE TO authenticated
  USING (
    can_write()
    AND (cidade_id IS NULL OR user_can_access_cidade(cidade_id))
  );

DROP POLICY IF EXISTS liderancas_insert ON public.liderancas;

CREATE POLICY liderancas_insert ON public.liderancas
  FOR INSERT TO authenticated
  WITH CHECK (
    can_write()
    AND (cidade_base_id IS NULL OR user_can_access_cidade(cidade_base_id))
  );

DROP POLICY IF EXISTS projecao_votos_insert ON public.projecao_votos;

CREATE POLICY projecao_votos_insert ON public.projecao_votos
  FOR INSERT TO authenticated
  WITH CHECK (can_write() AND user_can_access_cidade(cidade_id));

DROP POLICY IF EXISTS projecao_votos_update ON public.projecao_votos;

CREATE POLICY projecao_votos_update ON public.projecao_votos
  FOR UPDATE TO authenticated
  USING (can_write() AND user_can_access_cidade(cidade_id));

DROP POLICY IF EXISTS ig_snapshots_insert ON public.instagram_daily_snapshots;

CREATE POLICY ig_snapshots_insert ON public.instagram_daily_snapshots
  FOR INSERT TO authenticated
  WITH CHECK (can_write());

DROP POLICY IF EXISTS ig_snapshots_update ON public.instagram_daily_snapshots;

CREATE POLICY ig_snapshots_update ON public.instagram_daily_snapshots
  FOR UPDATE TO authenticated
  USING (can_write());

DROP POLICY IF EXISTS scs_insert ON public.social_competitor_snapshots;

CREATE POLICY scs_insert ON public.social_competitor_snapshots
  FOR INSERT TO authenticated
  WITH CHECK (can_write());

DROP POLICY IF EXISTS scs_update ON public.social_competitor_snapshots;

CREATE POLICY scs_update ON public.social_competitor_snapshots
  FOR UPDATE TO authenticated
  USING (can_write());
