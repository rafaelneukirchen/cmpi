-- Exportação sem dados: somente estrutura e lógica.
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.leads_centralizados (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chave_licenca TEXT NOT NULL,
  cliente_nome TEXT,
  url_origem TEXT,
  nome_completo TEXT NOT NULL,
  telefone TEXT,
  bairro TEXT,
  cidade_nome TEXT,
  zona_eleitoral TEXT,
  tipo_captador TEXT,
  captador_nome TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  origem_lead_id UUID,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leads_central_licenca ON public.leads_centralizados(chave_licenca);

CREATE INDEX IF NOT EXISTS idx_leads_central_telefone ON public.leads_centralizados(telefone);

CREATE INDEX IF NOT EXISTS idx_leads_central_captured ON public.leads_centralizados(captured_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_leads_central_origem
  ON public.leads_centralizados(chave_licenca, origem_lead_id)
  WHERE origem_lead_id IS NOT NULL;

ALTER TABLE public.leads_centralizados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leads_central_select_super_admin"
  ON public.leads_centralizados FOR SELECT TO authenticated
  USING (public.is_super_admin());

CREATE POLICY "leads_central_update_super_admin"
  ON public.leads_centralizados FOR UPDATE TO authenticated
  USING (public.is_super_admin());

CREATE POLICY "leads_central_delete_super_admin"
  ON public.leads_centralizados FOR DELETE TO authenticated
  USING (public.is_super_admin());

CREATE OR REPLACE FUNCTION public.forward_lead_to_central()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_license TEXT;
  v_webhook TEXT;
  v_url TEXT;
  v_captor_nome TEXT;
  v_cidade_nome TEXT;
BEGIN
  -- Lê chave da licença armazenada em app_settings
  SELECT value INTO v_license FROM public.app_settings WHERE key = 'license_key' LIMIT 1;
  IF v_license IS NULL OR length(trim(v_license)) = 0 THEN
    RETURN NEW;
  END IF;

  -- URL fixa da central (painel-mãe)
  v_webhook := 'https://unlophbeegjpmjfykmwk.supabase.co/functions/v1/receive-lead-webhook';

  -- URL do clone (opcional)
  SELECT value INTO v_url FROM public.app_settings WHERE key = 'app_url' LIMIT 1;

  -- Nome do captador
  IF NEW.tipo_captador = 'lideranca' AND NEW.lideranca_id IS NOT NULL THEN
    SELECT nome INTO v_captor_nome FROM public.liderancas WHERE id = NEW.lideranca_id;
  ELSIF NEW.captado_por_user_id IS NOT NULL THEN
    SELECT nome INTO v_captor_nome FROM public.profiles WHERE user_id = NEW.captado_por_user_id;
  END IF;

  -- Cidade
  IF NEW.cidade_id IS NOT NULL THEN
    SELECT nome INTO v_cidade_nome FROM public.cidades WHERE id = NEW.cidade_id;
  END IF;
  v_cidade_nome := COALESCE(v_cidade_nome, NEW.cidade_nome);

  -- Dispara POST assíncrono (não bloqueia o insert)
  PERFORM extensions.http_post(
    url := v_webhook,
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object(
      'license_key', v_license,
      'app_url', v_url,
      'origem_lead_id', NEW.id,
      'nome_completo', NEW.nome_completo,
      'telefone', NEW.telefone,
      'bairro', NEW.bairro,
      'cidade_nome', v_cidade_nome,
      'zona_eleitoral', NEW.zona_eleitoral,
      'tipo_captador', NEW.tipo_captador,
      'captador_nome', v_captor_nome,
      'latitude', NEW.latitude,
      'longitude', NEW.longitude,
      'captured_at', NEW.created_at
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Nunca falha o insert por erro de webhook
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_forward_lead_to_central ON public.eleitores_captados;

CREATE TRIGGER trg_forward_lead_to_central
  AFTER INSERT ON public.eleitores_captados
  FOR EACH ROW
  EXECUTE FUNCTION public.forward_lead_to_central();
