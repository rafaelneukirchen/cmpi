-- Exportação sem dados: somente estrutura e lógica.
CREATE TABLE public.lead_contact_status (
  phone_key TEXT PRIMARY KEY,
  confirm_status TEXT CHECK (confirm_status IN ('confirmado','nao_confirmado')),
  observacao TEXT,
  sent_at TIMESTAMPTZ,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_contact_status TO authenticated;

GRANT ALL ON public.lead_contact_status TO service_role;

ALTER TABLE public.lead_contact_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados podem ver status" ON public.lead_contact_status
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Autenticados podem inserir status" ON public.lead_contact_status
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Autenticados podem atualizar status" ON public.lead_contact_status
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Admins podem apagar status" ON public.lead_contact_status
  FOR DELETE TO authenticated USING (public.is_admin());

CREATE TRIGGER trg_lead_contact_status_updated_at
  BEFORE UPDATE ON public.lead_contact_status
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
