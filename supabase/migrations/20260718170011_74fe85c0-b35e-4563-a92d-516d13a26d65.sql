-- Exportação sem dados: somente estrutura e lógica.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS lideranca_vinculada_id uuid REFERENCES public.liderancas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_lideranca_vinculada ON public.profiles(lideranca_vinculada_id);

CREATE OR REPLACE FUNCTION public.captar_eleitor_publico_v2(
  p_token text,
  p_nome_completo text,
  p_telefone text DEFAULT NULL::text,
  p_bairro text DEFAULT NULL::text,
  p_cidade_nome text DEFAULT NULL::text,
  p_zona_eleitoral text DEFAULT NULL::text,
  p_latitude double precision DEFAULT NULL::double precision,
  p_longitude double precision DEFAULT NULL::double precision,
  p_accuracy double precision DEFAULT NULL::double precision,
  p_observacoes text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_lideranca_id UUID;
  v_user_id UUID;
  v_cidade_base UUID;
  v_new_id UUID;
  v_token TEXT;
  v_tel TEXT;
  v_lider_vinc UUID;
  v_lider_cidade UUID;
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
  v_tel := NULLIF(regexp_replace(coalesce(p_telefone,''), '\D', '', 'g'), '');

  IF v_tel IS NULL OR length(v_tel) < 10 OR length(v_tel) > 11 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Telefone obrigatório: informe DDD + número (10 ou 11 dígitos).');
  END IF;

  -- Liderança direta
  SELECT id, cidade_base_id INTO v_lideranca_id, v_cidade_base
  FROM public.liderancas WHERE token_publico = v_token LIMIT 1;

  IF v_lideranca_id IS NOT NULL THEN
    BEGIN
      INSERT INTO public.eleitores_captados (
        lideranca_id, captado_por_user_id, tipo_captador,
        nome_completo, telefone, bairro, cidade_id, cidade_nome,
        zona_eleitoral, latitude, longitude, accuracy, observacoes, origem
      ) VALUES (
        v_lideranca_id, NULL, 'lideranca',
        trim(p_nome_completo),
        NULLIF(trim(coalesce(p_telefone,'')), ''),
        NULLIF(trim(coalesce(p_bairro,'')), ''),
        v_cidade_base,
        NULLIF(trim(coalesce(p_cidade_nome,'')), ''),
        NULLIF(trim(coalesce(p_zona_eleitoral,'')), ''),
        p_latitude, p_longitude, p_accuracy,
        NULLIF(trim(coalesce(p_observacoes,'')), ''),
        'campo_publico'
      ) RETURNING id INTO v_new_id;
      RETURN jsonb_build_object('success', true, 'id', v_new_id, 'tipo', 'lideranca');
    EXCEPTION WHEN unique_violation OR raise_exception THEN
      RETURN jsonb_build_object('success', false, 'duplicate', true, 'error', 'Este telefone já está cadastrado no sistema.');
    END;
  END IF;

  -- Usuário
  SELECT user_id, lideranca_vinculada_id INTO v_user_id, v_lider_vinc
  FROM public.profiles WHERE token_publico = v_token LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    -- Se o usuário tem liderança vinculada, credita também à liderança
    IF v_lider_vinc IS NOT NULL THEN
      SELECT cidade_base_id INTO v_lider_cidade FROM public.liderancas WHERE id = v_lider_vinc;
    END IF;

    BEGIN
      INSERT INTO public.eleitores_captados (
        lideranca_id, captado_por_user_id, tipo_captador,
        nome_completo, telefone, bairro, cidade_id, cidade_nome,
        zona_eleitoral, latitude, longitude, accuracy, observacoes, origem
      ) VALUES (
        v_lider_vinc, v_user_id, 'usuario',
        trim(p_nome_completo),
        NULLIF(trim(coalesce(p_telefone,'')), ''),
        NULLIF(trim(coalesce(p_bairro,'')), ''),
        COALESCE(v_lider_cidade, NULL),
        NULLIF(trim(coalesce(p_cidade_nome,'')), ''),
        NULLIF(trim(coalesce(p_zona_eleitoral,'')), ''),
        p_latitude, p_longitude, p_accuracy,
        NULLIF(trim(coalesce(p_observacoes,'')), ''),
        'campo_publico'
      ) RETURNING id INTO v_new_id;
      RETURN jsonb_build_object('success', true, 'id', v_new_id, 'tipo', 'usuario');
    EXCEPTION WHEN unique_violation OR raise_exception THEN
      RETURN jsonb_build_object('success', false, 'duplicate', true, 'error', 'Este telefone já está cadastrado no sistema.');
    END;
  END IF;

  RETURN jsonb_build_object('success', false, 'error', 'Link inválido ou expirado');
END;
$function$;
