-- Exportação sem dados: somente estrutura e lógica.
ALTER TABLE public.liderancas
  ADD COLUMN IF NOT EXISTS token_publico TEXT UNIQUE;

CREATE OR REPLACE FUNCTION public.generate_lideranca_token()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  new_token TEXT;
  exists_check INT;
BEGIN
  LOOP
    new_token := lower(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 12));
    SELECT count(*) INTO exists_check FROM public.liderancas WHERE token_publico = new_token;
    EXIT WHEN exists_check = 0;
  END LOOP;
  RETURN new_token;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_lideranca_token()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.token_publico IS NULL THEN
    NEW.token_publico := public.generate_lideranca_token();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_lideranca_token ON public.liderancas;

CREATE TRIGGER trg_set_lideranca_token
  BEFORE INSERT ON public.liderancas
  FOR EACH ROW
  EXECUTE FUNCTION public.set_lideranca_token();

CREATE TABLE IF NOT EXISTS public.eleitores_captados (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lideranca_id UUID NOT NULL REFERENCES public.liderancas(id) ON DELETE CASCADE,
  nome_completo TEXT NOT NULL,
  telefone TEXT,
  bairro TEXT,
  cidade_id UUID REFERENCES public.cidades(id),
  cidade_nome TEXT,
  zona_eleitoral TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  accuracy DOUBLE PRECISION,
  observacoes TEXT,
  origem TEXT NOT NULL DEFAULT 'campo_publico',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_eleitores_captados_lideranca ON public.eleitores_captados(lideranca_id);

CREATE INDEX IF NOT EXISTS idx_eleitores_captados_cidade ON public.eleitores_captados(cidade_id);

ALTER TABLE public.eleitores_captados ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_eleitores_captados_updated ON public.eleitores_captados;

CREATE TRIGGER trg_eleitores_captados_updated
  BEFORE UPDATE ON public.eleitores_captados
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "eleitores_captados_select"
ON public.eleitores_captados
FOR SELECT
TO authenticated
USING (
  is_admin()
  OR EXISTS (
    SELECT 1 FROM public.liderancas l
    WHERE l.id = eleitores_captados.lideranca_id
      AND (
        l.coordenador_user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.coordenador_cidades cc
          WHERE cc.user_id = auth.uid()
            AND (cc.cidade_id = l.cidade_base_id OR cc.cidade_id = ANY(l.cidades_representadas))
        )
      )
  )
);

CREATE POLICY "eleitores_captados_update"
ON public.eleitores_captados
FOR UPDATE
TO authenticated
USING (can_write());

CREATE POLICY "eleitores_captados_delete"
ON public.eleitores_captados
FOR DELETE
TO authenticated
USING (is_admin());

CREATE POLICY "eleitores_captados_insert_auth"
ON public.eleitores_captados
FOR INSERT
TO authenticated
WITH CHECK (can_write());

CREATE OR REPLACE FUNCTION public.captar_eleitor_publico(
  p_token TEXT,
  p_nome_completo TEXT,
  p_telefone TEXT DEFAULT NULL,
  p_bairro TEXT DEFAULT NULL,
  p_cidade_nome TEXT DEFAULT NULL,
  p_zona_eleitoral TEXT DEFAULT NULL,
  p_latitude DOUBLE PRECISION DEFAULT NULL,
  p_longitude DOUBLE PRECISION DEFAULT NULL,
  p_accuracy DOUBLE PRECISION DEFAULT NULL,
  p_observacoes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lideranca_id UUID;
  v_cidade_base UUID;
  v_new_id UUID;
BEGIN
  -- Validações
  IF p_token IS NULL OR length(trim(p_token)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Token inválido');
  END IF;
  IF p_nome_completo IS NULL OR length(trim(p_nome_completo)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nome é obrigatório');
  END IF;
  IF length(p_nome_completo) > 200 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Nome muito longo');
  END IF;

  -- Buscar liderança pelo token
  SELECT id, cidade_base_id INTO v_lideranca_id, v_cidade_base
  FROM public.liderancas
  WHERE token_publico = lower(trim(p_token))
  LIMIT 1;

  IF v_lideranca_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Link inválido ou expirado');
  END IF;

  INSERT INTO public.eleitores_captados (
    lideranca_id, nome_completo, telefone, bairro, cidade_id, cidade_nome,
    zona_eleitoral, latitude, longitude, accuracy, observacoes, origem
  ) VALUES (
    v_lideranca_id,
    trim(p_nome_completo),
    NULLIF(trim(coalesce(p_telefone, '')), ''),
    NULLIF(trim(coalesce(p_bairro, '')), ''),
    v_cidade_base,
    NULLIF(trim(coalesce(p_cidade_nome, '')), ''),
    NULLIF(trim(coalesce(p_zona_eleitoral, '')), ''),
    p_latitude,
    p_longitude,
    p_accuracy,
    NULLIF(trim(coalesce(p_observacoes, '')), ''),
    'campo_publico'
  )
  RETURNING id INTO v_new_id;

  RETURN jsonb_build_object('success', true, 'id', v_new_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.captar_eleitor_publico(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_lideranca_publica(p_token TEXT)
RETURNS TABLE(nome TEXT, cidade_nome TEXT)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT l.nome, c.nome
  FROM public.liderancas l
  LEFT JOIN public.cidades c ON c.id = l.cidade_base_id
  WHERE l.token_publico = lower(trim(p_token))
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_lideranca_publica(TEXT) TO anon, authenticated;
