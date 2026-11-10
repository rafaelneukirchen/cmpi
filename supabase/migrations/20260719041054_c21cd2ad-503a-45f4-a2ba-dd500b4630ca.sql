-- Exportação sem dados: somente estrutura e lógica.
DROP TABLE IF EXISTS public.whatsapp_config CASCADE;

CREATE TABLE public.whatsapp_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  instance_name text NOT NULL UNIQUE,
  phone text,
  profile_name text,
  profile_picture text,
  connected boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'created',
  qr_code text,
  last_connection timestamptz,
  battery integer,
  webhook_status text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_instances TO authenticated;

GRANT ALL ON public.whatsapp_instances TO service_role;

ALTER TABLE public.whatsapp_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wa_inst_select_own_or_admin" ON public.whatsapp_instances
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "wa_inst_insert_self" ON public.whatsapp_instances
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "wa_inst_update_own_or_admin" ON public.whatsapp_instances
  FOR UPDATE TO authenticated USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "wa_inst_delete_own_or_admin" ON public.whatsapp_instances
  FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.is_admin());

CREATE TRIGGER trg_wa_inst_updated BEFORE UPDATE ON public.whatsapp_instances
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id uuid REFERENCES public.whatsapp_instances(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  direction text NOT NULL DEFAULT 'outbound',
  to_number text,
  from_number text,
  message_type text NOT NULL DEFAULT 'text',
  content text,
  media_url text,
  caption text,
  status text NOT NULL DEFAULT 'pending',
  error text,
  external_id text,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_wa_msg_user_created ON public.whatsapp_messages(user_id, created_at DESC);

CREATE INDEX idx_wa_msg_instance ON public.whatsapp_messages(instance_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_messages TO authenticated;

GRANT ALL ON public.whatsapp_messages TO service_role;

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wa_msg_select_own_or_admin" ON public.whatsapp_messages
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "wa_msg_insert_self" ON public.whatsapp_messages
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "wa_msg_update_own_or_admin" ON public.whatsapp_messages
  FOR UPDATE TO authenticated USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "wa_msg_delete_own_or_admin" ON public.whatsapp_messages
  FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.is_admin());

CREATE TRIGGER trg_wa_msg_updated BEFORE UPDATE ON public.whatsapp_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.whatsapp_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_name text,
  event text,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_wa_webhook_instance ON public.whatsapp_webhook_events(instance_name, created_at DESC);

GRANT SELECT ON public.whatsapp_webhook_events TO authenticated;

GRANT ALL ON public.whatsapp_webhook_events TO service_role;

ALTER TABLE public.whatsapp_webhook_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wa_webhook_admin_select" ON public.whatsapp_webhook_events
  FOR SELECT TO authenticated USING (public.is_admin());

ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_instances;

ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;
