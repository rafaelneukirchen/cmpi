-- Exportação sem dados: somente estrutura e lógica.
CREATE OR REPLACE FUNCTION public.captar_eleitor_publico_v2(p_token text, p_nome_completo text, p_telefone text DEFAULT NULL::text, p_bairro text DEFAULT NULL::text, p_cidade_nome text DEFAULT NULL::text, p_zona_eleitoral text DEFAULT NULL::text, p_latitude double precision DEFAULT NULL::double precision, p_longitude double precision DEFAULT NULL::double precision, p_accuracy double precision DEFAULT NULL::double precision, p_observacoes text DEFAULT NULL::text)
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
  v_nome TEXT;
  v_dup_id UUID;
  v_dup_lid UUID;
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
  v_nome := lower(trim(p_nome_completo));

  -- Anti-duplicata por telefone: verifica em eleitores_captados E em liderancas
  IF v_tel IS NOT NULL THEN
    SELECT id INTO v_dup_id FROM public.eleitores_captados
    WHERE regexp_replace(coalesce(telefone,''), '\D', '', 'g') = v_tel
       OR regexp_replace(coalesce(telefone,''), '\D', '', 'g') = v_tel
    LIMIT 1;

    IF v_dup_id IS NULL THEN
      SELECT id INTO v_dup_lid FROM public.liderancas
      WHERE regexp_replace(coalesce(telefone,''), '\D', '', 'g') = v_tel
         OR regexp_replace(coalesce(whatsapp,''), '\D', '', 'g') = v_tel
      LIMIT 1;
    END IF;

    IF v_dup_id IS NOT NULL OR v_dup_lid IS NOT NULL THEN
      RETURN jsonb_build_object('success', false, 'duplicate', true, 'error', 'Este telefone já está cadastrado no sistema.');
    END IF;
  ELSE
    -- Sem telefone: anti-duplicata por nome exato (apenas em eleitores_captados sem telefone)
    SELECT id INTO v_dup_id FROM public.eleitores_captados
    WHERE lower(trim(nome_completo)) = v_nome
      AND (telefone IS NULL OR telefone = '')
    LIMIT 1;
    IF v_dup_id IS NOT NULL THEN
      RETURN jsonb_build_object('success', false, 'duplicate', true, 'error', 'Este eleitor já foi cadastrado anteriormente.');
    END IF;
  END IF;

  -- Liderança
  SELECT id, cidade_base_id INTO v_lideranca_id, v_cidade_base
  FROM public.liderancas WHERE token_publico = v_token LIMIT 1;

  IF v_lideranca_id IS NOT NULL THEN
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
  END IF;

  -- Usuário
  SELECT user_id INTO v_user_id
  FROM public.profiles WHERE token_publico = v_token LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    INSERT INTO public.eleitores_captados (
      lideranca_id, captado_por_user_id, tipo_captador,
      nome_completo, telefone, bairro, cidade_id, cidade_nome,
      zona_eleitoral, latitude, longitude, accuracy, observacoes, origem
    ) VALUES (
      NULL, v_user_id, 'usuario',
      trim(p_nome_completo),
      NULLIF(trim(coalesce(p_telefone,'')), ''),
      NULLIF(trim(coalesce(p_bairro,'')), ''),
      NULL,
      NULLIF(trim(coalesce(p_cidade_nome,'')), ''),
      NULLIF(trim(coalesce(p_zona_eleitoral,'')), ''),
      p_latitude, p_longitude, p_accuracy,
      NULLIF(trim(coalesce(p_observacoes,'')), ''),
      'campo_publico'
    ) RETURNING id INTO v_new_id;
    RETURN jsonb_build_object('success', true, 'id', v_new_id, 'tipo', 'usuario');
  END IF;

  RETURN jsonb_build_object('success', false, 'error', 'Link inválido ou expirado');
END;
$function$;
