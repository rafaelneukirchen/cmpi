-- Exportação sem dados: somente estrutura e lógica.
CREATE OR REPLACE FUNCTION public.user_can_access_cidade(_cidade_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.coordenador_cidades
      WHERE user_id = auth.uid() AND cidade_id = _cidade_id
    )
$$;

CREATE INDEX IF NOT EXISTS idx_coordenador_cidades_user_cidade
ON public.coordenador_cidades (user_id, cidade_id);

DROP POLICY IF EXISTS "cidades_select" ON public.cidades;

CREATE POLICY "cidades_select" ON public.cidades
  FOR SELECT TO authenticated
  USING (public.user_can_access_cidade(id));

DROP POLICY IF EXISTS "liderancas_select" ON public.liderancas;

CREATE POLICY "liderancas_select" ON public.liderancas
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR coordenador_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.coordenador_cidades cc
      WHERE cc.user_id = auth.uid()
      AND (cc.cidade_id = cidade_base_id OR cc.cidade_id = ANY(cidades_representadas))
    )
  );

DROP POLICY IF EXISTS "projecao_votos_select" ON public.projecao_votos;

CREATE POLICY "projecao_votos_select" ON public.projecao_votos
  FOR SELECT TO authenticated
  USING (public.user_can_access_cidade(cidade_id));

DROP POLICY IF EXISTS "dobradinhas_select" ON public.dobradinhas;

CREATE POLICY "dobradinhas_select" ON public.dobradinhas
  FOR SELECT TO authenticated
  USING (public.user_can_access_cidade(cidade_id));

DROP POLICY IF EXISTS "visitas_campanha_select" ON public.visitas_campanha;

CREATE POLICY "visitas_campanha_select" ON public.visitas_campanha
  FOR SELECT TO authenticated
  USING (public.user_can_access_cidade(cidade_id));

DROP POLICY IF EXISTS "estrutura_campanha_select" ON public.estrutura_campanha;

CREATE POLICY "estrutura_campanha_select" ON public.estrutura_campanha
  FOR SELECT TO authenticated
  USING (public.user_can_access_cidade(cidade_id));

DROP POLICY IF EXISTS "agenda_campanha_select" ON public.agenda_campanha;

CREATE POLICY "agenda_campanha_select" ON public.agenda_campanha
  FOR SELECT TO authenticated
  USING (public.user_can_access_cidade(cidade_id));
