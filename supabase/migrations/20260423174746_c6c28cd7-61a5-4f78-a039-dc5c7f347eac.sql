-- Exportação sem dados: somente estrutura e lógica.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS token_publico TEXT UNIQUE;

CREATE OR REPLACE FUNCTION public.generate_profile_token()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  new_token TEXT;
  exists_check INT;
BEGIN
  LOOP
    new_token := lower(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 12));
    SELECT count(*) INTO exists_check FROM public.profiles WHERE token_publico = new_token;
    EXIT WHEN exists_check = 0;
  END LOOP;
  RETURN new_token;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_profile_token()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.token_publico IS NULL THEN
    NEW.token_publico := public.generate_profile_token();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_profile_token ON public.profiles;

CREATE TRIGGER trg_set_profile_token
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_profile_token();

ALTER TABLE public.eleitores_captados
  ALTER COLUMN lideranca_id DROP NOT NULL;

ALTER TABLE public.eleitores_captados
  ADD COLUMN IF NOT EXISTS captado_por_user_id UUID,
  ADD COLUMN IF NOT EXISTS tipo_captador TEXT NOT NULL DEFAULT 'lideranca'
    CHECK (tipo_captador IN ('lideranca', 'usuario'));

ALTER TABLE public.eleitores_captados
  DROP CONSTRAINT IF EXISTS eleitores_captados_origem_check;

ALTER TABLE public.eleitores_captados
  ADD CONSTRAINT eleitores_captados_origem_check
  CHECK (lideranca_id IS NOT NULL OR captado_por_user_id IS NOT NULL);

DROP POLICY IF EXISTS eleitores_captados_select ON public.eleitores_captados;

CREATE POLICY eleitores_captados_select ON public.eleitores_captados
  FOR SELECT TO authenticated
  USING (
    is_admin()
    OR captado_por_user_id = auth.uid()
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

CREATE OR REPLACE FUNCTION public.get_captador_publico(p_token text)
RETURNS TABLE(nome text, cidade_nome text, tipo text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT l.nome, c.nome AS cidade_nome, 'lideranca'::text AS tipo
  FROM public.liderancas l
  LEFT JOIN public.cidades c ON c.id = l.cidade_base_id
  WHERE l.token_publico = lower(trim(p_token))
  UNION ALL
  SELECT p.nome, NULL::text AS cidade_nome, 'usuario'::text AS tipo
  FROM public.profiles p
  WHERE p.token_publico = lower(trim(p_token))
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.captar_eleitor_publico_v2(
  p_token text,
  p_nome_completo text,
  p_telefone text DEFAULT NULL,
  p_bairro text DEFAULT NULL,
  p_cidade_nome text DEFAULT NULL,
  p_zona_eleitoral text DEFAULT NULL,
  p_latitude double precision DEFAULT NULL,
  p_longitude double precision DEFAULT NULL,
  p_accuracy double precision DEFAULT NULL,
  p_observacoes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lideranca_id UUID;
  v_user_id UUID;
  v_cidade_base UUID;
  v_new_id UUID;
  v_token TEXT;
BEGIN
  IF p_token IS NULL OR length(trim(p_token)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Token inválido');
  END IF;
  IF p_nome_completo IS NULL OR length(trim(p_nome_completo)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nome é obrigatório');
  END IF;
  IF length(p_nome_completo) > 200 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nome muito longo');
  END IF;

  v_token := lower(trim(p_token));

  -- Tenta liderança primeiro
  SELECT id, cidade_base_id INTO v_lideranca_id, v_cidade_base
  FROM public.liderancas
  WHERE token_publico = v_token
  LIMIT 1;

  IF v_lideranca_id IS NOT NULL THEN
    INSERT INTO public.eleitores_captados (
      lideranca_id, captado_por_user_id, tipo_captador,
      nome_completo, telefone, bairro, cidade_id, cidade_nome,
      zona_eleitoral, latitude, longitude, accuracy, observacoes, origem
    ) VALUES (
      v_lideranca_id, NULL, 'lideranca',
      trim(p_nome_completo),
      NULLIF(trim(coalesce(p_telefone, '')), ''),
      NULLIF(trim(coalesce(p_bairro, '')), ''),
      v_cidade_base,
      NULLIF(trim(coalesce(p_cidade_nome, '')), ''),
      NULLIF(trim(coalesce(p_zona_eleitoral, '')), ''),
      p_latitude, p_longitude, p_accuracy,
      NULLIF(trim(coalesce(p_observacoes, '')), ''),
      'campo_publico'
    )
    RETURNING id INTO v_new_id;
    RETURN jsonb_build_object('success', true, 'id', v_new_id, 'tipo', 'lideranca');
  END IF;

  -- Tenta usuário
  SELECT user_id INTO v_user_id
  FROM public.profiles
  WHERE token_publico = v_token
  LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    INSERT INTO public.eleitores_captados (
      lideranca_id, captado_por_user_id, tipo_captador,
      nome_completo, telefone, bairro, cidade_id, cidade_nome,
      zona_eleitoral, latitude, longitude, accuracy, observacoes, origem
    ) VALUES (
      NULL, v_user_id, 'usuario',
      trim(p_nome_completo),
      NULLIF(trim(coalesce(p_telefone, '')), ''),
      NULLIF(trim(coalesce(p_bairro, '')), ''),
      NULL,
      NULLIF(trim(coalesce(p_cidade_nome, '')), ''),
      NULLIF(trim(coalesce(p_zona_eleitoral, '')), ''),
      p_latitude, p_longitude, p_accuracy,
      NULLIF(trim(coalesce(p_observacoes, '')), ''),
      'campo_publico'
    )
    RETURNING id INTO v_new_id;
    RETURN jsonb_build_object('success', true, 'id', v_new_id, 'tipo', 'usuario');
  END IF;

  RETURN jsonb_build_object('success', false, 'error', 'Link inválido ou expirado');
END;
$$;
