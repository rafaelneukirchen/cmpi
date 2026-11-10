-- Exportação sem dados: somente estrutura e lógica.
CREATE TABLE public.integration_secrets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service TEXT NOT NULL,
  key_name TEXT NOT NULL,
  key_value TEXT,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (service, key_name)
);

ALTER TABLE public.integration_secrets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "integration_secrets_select" ON public.integration_secrets
  FOR SELECT TO authenticated USING (is_admin());

CREATE POLICY "integration_secrets_insert" ON public.integration_secrets
  FOR INSERT TO authenticated WITH CHECK (is_admin());

CREATE POLICY "integration_secrets_update" ON public.integration_secrets
  FOR UPDATE TO authenticated USING (is_admin());

CREATE POLICY "integration_secrets_delete" ON public.integration_secrets
  FOR DELETE TO authenticated USING (is_admin());

CREATE TRIGGER update_integration_secrets_updated_at
  BEFORE UPDATE ON public.integration_secrets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.get_integration_secret(p_service TEXT, p_key_name TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT key_value
  FROM public.integration_secrets
  WHERE service = p_service
    AND key_name = p_key_name
    AND is_active = true
  LIMIT 1;
$$;
