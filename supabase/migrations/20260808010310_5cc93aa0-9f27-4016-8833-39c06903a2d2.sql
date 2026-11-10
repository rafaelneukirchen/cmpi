-- Exportação sem dados: somente estrutura e lógica.
CREATE OR REPLACE FUNCTION public.can_manage_lead_status()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin() OR EXISTS (
    SELECT 1 FROM public.user_permissions
    WHERE user_id = auth.uid() AND module = 'whatsapp_envio'
  );
$$;

DROP POLICY IF EXISTS "Autenticados podem inserir status" ON public.lead_contact_status;

DROP POLICY IF EXISTS "Autenticados podem atualizar status" ON public.lead_contact_status;

DROP POLICY IF EXISTS "Admins podem apagar status" ON public.lead_contact_status;

CREATE POLICY "Autorizados podem inserir status"
ON public.lead_contact_status FOR INSERT TO authenticated
WITH CHECK (public.can_manage_lead_status());

CREATE POLICY "Autorizados podem atualizar status"
ON public.lead_contact_status FOR UPDATE TO authenticated
USING (public.can_manage_lead_status())
WITH CHECK (public.can_manage_lead_status());

CREATE POLICY "Admins podem apagar status"
ON public.lead_contact_status FOR DELETE TO authenticated
USING (public.is_admin());
