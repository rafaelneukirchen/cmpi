-- Exportação sem dados: somente estrutura e lógica.
DO $$ BEGIN
  CREATE TYPE public.tipo_acao_campo AS ENUM (
    'panfletagem_semaforo','panfletagem_feira','corpo_a_corpo_residencial','corpo_a_corpo_comercial',
    'bandeiraco','adesivaco','caminhada','carreata','motociata',
    'reuniao_comunitaria','evento_liderancas','visita_institucional'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.planejamento_semanal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  semana_inicio date NOT NULL,
  semana_fim date NOT NULL,
  coordenador_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  lideranca_id uuid REFERENCES public.liderancas(id) ON DELETE SET NULL,
  cidade_id uuid REFERENCES public.cidades(id) ON DELETE SET NULL,
  bairro_principal text,
  bairros_secundarios text[] DEFAULT '{}',
  meta_semana text,
  equipe_prevista int DEFAULT 0,
  status text NOT NULL DEFAULT 'ativo',
  criado_por_user_id uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.planejamento_semanal TO authenticated;

GRANT ALL ON public.planejamento_semanal TO service_role;

ALTER TABLE public.planejamento_semanal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "planejamento_select" ON public.planejamento_semanal FOR SELECT TO authenticated
  USING (public.is_admin() OR cidade_id IS NULL OR public.user_can_access_cidade(cidade_id));

CREATE POLICY "planejamento_insert" ON public.planejamento_semanal FOR INSERT TO authenticated
  WITH CHECK (public.can_write());

CREATE POLICY "planejamento_update" ON public.planejamento_semanal FOR UPDATE TO authenticated
  USING (public.can_write()) WITH CHECK (public.can_write());

CREATE POLICY "planejamento_delete" ON public.planejamento_semanal FOR DELETE TO authenticated
  USING (public.is_admin());

CREATE TRIGGER trg_planejamento_semanal_updated BEFORE UPDATE ON public.planejamento_semanal
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.acoes_planejadas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  planejamento_id uuid NOT NULL REFERENCES public.planejamento_semanal(id) ON DELETE CASCADE,
  tipo_acao public.tipo_acao_campo NOT NULL,
  data_prevista date,
  hora_prevista time,
  local_previsto text,
  participantes_previstos int DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.acoes_planejadas TO authenticated;

GRANT ALL ON public.acoes_planejadas TO service_role;

ALTER TABLE public.acoes_planejadas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "acoes_pl_select" ON public.acoes_planejadas FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.planejamento_semanal p WHERE p.id = planejamento_id));

CREATE POLICY "acoes_pl_insert" ON public.acoes_planejadas FOR INSERT TO authenticated WITH CHECK (public.can_write());

CREATE POLICY "acoes_pl_update" ON public.acoes_planejadas FOR UPDATE TO authenticated USING (public.can_write()) WITH CHECK (public.can_write());

CREATE POLICY "acoes_pl_delete" ON public.acoes_planejadas FOR DELETE TO authenticated USING (public.can_write());

CREATE TRIGGER trg_acoes_planejadas_updated BEFORE UPDATE ON public.acoes_planejadas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_acoes_pl_plan ON public.acoes_planejadas(planejamento_id);

CREATE TABLE IF NOT EXISTS public.acoes_execucao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  acao_planejada_id uuid REFERENCES public.acoes_planejadas(id) ON DELETE SET NULL,
  planejamento_id uuid REFERENCES public.planejamento_semanal(id) ON DELETE SET NULL,
  tipo_acao public.tipo_acao_campo NOT NULL,
  iniciado_por_user_id uuid DEFAULT auth.uid(),
  iniciado_em timestamptz NOT NULL DEFAULT now(),
  lat_inicio double precision,
  lng_inicio double precision,
  encerrado_em timestamptz,
  lat_fim double precision,
  lng_fim double precision,
  distancia_metros double precision DEFAULT 0,
  participantes_reais int DEFAULT 0,
  bairro_execucao text,
  cidade_execucao text,
  cidade_id uuid REFERENCES public.cidades(id) ON DELETE SET NULL,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.acoes_execucao TO authenticated;

GRANT ALL ON public.acoes_execucao TO service_role;

ALTER TABLE public.acoes_execucao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "acoes_ex_select" ON public.acoes_execucao FOR SELECT TO authenticated
  USING (public.is_admin() OR iniciado_por_user_id = auth.uid() OR cidade_id IS NULL OR public.user_can_access_cidade(cidade_id));

CREATE POLICY "acoes_ex_insert" ON public.acoes_execucao FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "acoes_ex_update" ON public.acoes_execucao FOR UPDATE TO authenticated
  USING (iniciado_por_user_id = auth.uid() OR public.is_admin())
  WITH CHECK (iniciado_por_user_id = auth.uid() OR public.is_admin());

CREATE POLICY "acoes_ex_delete" ON public.acoes_execucao FOR DELETE TO authenticated USING (public.is_admin());

CREATE TRIGGER trg_acoes_execucao_updated BEFORE UPDATE ON public.acoes_execucao
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_acoes_ex_user ON public.acoes_execucao(iniciado_por_user_id);

CREATE INDEX IF NOT EXISTS idx_acoes_ex_cidade ON public.acoes_execucao(cidade_id);

CREATE INDEX IF NOT EXISTS idx_acoes_ex_inicio ON public.acoes_execucao(iniciado_em);

CREATE TABLE IF NOT EXISTS public.acoes_midias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  execucao_id uuid NOT NULL REFERENCES public.acoes_execucao(id) ON DELETE CASCADE,
  url text NOT NULL,
  tipo text NOT NULL DEFAULT 'foto',
  criado_por uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.acoes_midias TO authenticated;

GRANT ALL ON public.acoes_midias TO service_role;

ALTER TABLE public.acoes_midias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "acoes_midias_select" ON public.acoes_midias FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.acoes_execucao e WHERE e.id = execucao_id));

CREATE POLICY "acoes_midias_insert" ON public.acoes_midias FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "acoes_midias_delete" ON public.acoes_midias FOR DELETE TO authenticated
  USING (criado_por = auth.uid() OR public.is_admin());

CREATE INDEX IF NOT EXISTS idx_acoes_midias_exec ON public.acoes_midias(execucao_id);

CREATE OR REPLACE FUNCTION public.calc_acao_distancia(p_exec_id uuid)
RETURNS double precision
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid;
  v_ini timestamptz;
  v_fim timestamptz;
  v_total double precision := 0;
  v_prev_lat double precision;
  v_prev_lng double precision;
  v_earth constant double precision := 6371000;
  rec record;
  d_lat double precision;
  d_lng double precision;
  v_a double precision;
  v_c double precision;
BEGIN
  SELECT iniciado_por_user_id, iniciado_em, COALESCE(encerrado_em, now())
    INTO v_user, v_ini, v_fim
  FROM public.acoes_execucao WHERE id = p_exec_id;
  IF v_user IS NULL THEN RETURN 0; END IF;

  FOR rec IN
    SELECT latitude, longitude FROM public.user_locations
    WHERE user_id = v_user AND captured_at BETWEEN v_ini AND v_fim
    ORDER BY captured_at ASC
  LOOP
    IF v_prev_lat IS NOT NULL THEN
      d_lat := radians(rec.latitude - v_prev_lat);
      d_lng := radians(rec.longitude - v_prev_lng);
      v_a := sin(d_lat/2)^2 + cos(radians(v_prev_lat))*cos(radians(rec.latitude))*sin(d_lng/2)^2;
      v_c := 2 * atan2(sqrt(v_a), sqrt(1 - v_a));
      v_total := v_total + v_earth * v_c;
    END IF;
    v_prev_lat := rec.latitude;
    v_prev_lng := rec.longitude;
  END LOOP;

  RETURN v_total;
END;
$$;
