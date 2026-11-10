-- Exportação sem dados: somente estrutura e lógica.
CREATE TABLE public.app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value text,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "app_settings_select" ON public.app_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "app_settings_insert" ON public.app_settings FOR INSERT TO authenticated WITH CHECK (is_admin());

CREATE POLICY "app_settings_update" ON public.app_settings FOR UPDATE TO authenticated USING (is_admin());

CREATE POLICY "app_settings_delete" ON public.app_settings FOR DELETE TO authenticated USING (is_admin());

CREATE POLICY "app_assets_select" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'app-assets');

CREATE POLICY "app_assets_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'app-assets' AND public.is_admin());

CREATE POLICY "app_assets_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'app-assets' AND public.is_admin());

CREATE POLICY "app_assets_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'app-assets' AND public.is_admin());
