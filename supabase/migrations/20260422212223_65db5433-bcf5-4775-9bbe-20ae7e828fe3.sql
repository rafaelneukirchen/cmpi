-- Exportação sem dados: somente estrutura e lógica.
DROP POLICY IF EXISTS "logistics_profiles_select" ON public.logistics_profiles;

CREATE POLICY "logistics_profiles_select"
ON public.logistics_profiles
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "audit_log_select" ON public.audit_log;

CREATE POLICY "audit_log_select"
ON public.audit_log
FOR SELECT
TO authenticated
USING (is_admin());

DROP POLICY IF EXISTS "audit_log_insert" ON public.audit_log;

CREATE POLICY "audit_log_insert"
ON public.audit_log
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "coordenador_cidades_select" ON public.coordenador_cidades;

CREATE POLICY "coordenador_cidades_select"
ON public.coordenador_cidades
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "profiles_select" ON public.profiles;

CREATE POLICY "profiles_select"
ON public.profiles
FOR SELECT
TO authenticated
USING (user_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "Public can read app-assets" ON storage.objects;

DROP POLICY IF EXISTS "app_assets_public_read" ON storage.objects;

DROP POLICY IF EXISTS "app_assets_admin_write" ON storage.objects;

DROP POLICY IF EXISTS "app_assets_admin_update" ON storage.objects;

DROP POLICY IF EXISTS "app_assets_admin_delete" ON storage.objects;

CREATE POLICY "app_assets_public_read"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'app-assets');

CREATE POLICY "app_assets_admin_write"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'app-assets' AND is_admin());

CREATE POLICY "app_assets_admin_update"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'app-assets' AND is_admin());

CREATE POLICY "app_assets_admin_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'app-assets' AND is_admin());
