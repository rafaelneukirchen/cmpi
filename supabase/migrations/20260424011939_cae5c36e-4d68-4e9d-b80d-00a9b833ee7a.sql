-- Exportação sem dados: somente estrutura e lógica.
CREATE TABLE public.whatsapp_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone_number_id TEXT NOT NULL,
  waba_id TEXT NOT NULL,
  display_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_test_at TIMESTAMP WITH TIME ZONE,
  last_test_status TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "whatsapp_config_select" ON public.whatsapp_config
  FOR SELECT TO authenticated USING (is_admin());

CREATE POLICY "whatsapp_config_insert" ON public.whatsapp_config
  FOR INSERT TO authenticated WITH CHECK (is_admin());

CREATE POLICY "whatsapp_config_update" ON public.whatsapp_config
  FOR UPDATE TO authenticated USING (is_admin());

CREATE POLICY "whatsapp_config_delete" ON public.whatsapp_config
  FOR DELETE TO authenticated USING (is_admin());

CREATE TRIGGER update_whatsapp_config_updated_at
  BEFORE UPDATE ON public.whatsapp_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
