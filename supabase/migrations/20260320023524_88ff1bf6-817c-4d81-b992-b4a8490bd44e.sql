-- Exportação sem dados: somente estrutura e lógica.
CREATE TABLE public.system_api_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plataforma text NOT NULL UNIQUE,
  access_token text NOT NULL,
  refresh_token text,
  expiracao_token timestamp with time zone,
  status text NOT NULL DEFAULT 'ativo',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.system_api_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "api_credentials_select" ON public.system_api_credentials
  FOR SELECT TO authenticated USING (is_admin());

CREATE POLICY "api_credentials_insert" ON public.system_api_credentials
  FOR INSERT TO authenticated WITH CHECK (is_admin());

CREATE POLICY "api_credentials_update" ON public.system_api_credentials
  FOR UPDATE TO authenticated USING (is_admin());

CREATE POLICY "api_credentials_delete" ON public.system_api_credentials
  FOR DELETE TO authenticated USING (is_admin());

CREATE TABLE public.social_discovery_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  username text NOT NULL,
  plataforma text NOT NULL,
  url_perfil text,
  foto_url text,
  categoria text DEFAULT 'político',
  score numeric DEFAULT 0,
  ativo boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.social_discovery_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "social_profiles_select" ON public.social_discovery_profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "social_profiles_insert" ON public.social_discovery_profiles
  FOR INSERT TO authenticated WITH CHECK (can_write());

CREATE POLICY "social_profiles_update" ON public.social_discovery_profiles
  FOR UPDATE TO authenticated USING (can_write());

CREATE POLICY "social_profiles_delete" ON public.social_discovery_profiles
  FOR DELETE TO authenticated USING (is_admin());

CREATE TABLE public.social_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.social_discovery_profiles(id) ON DELETE CASCADE,
  seguidores integer DEFAULT 0,
  total_posts integer DEFAULT 0,
  engajamento numeric DEFAULT 0,
  crescimento numeric DEFAULT 0,
  data_coleta timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.social_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "social_metrics_select" ON public.social_metrics
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "social_metrics_insert" ON public.social_metrics
  FOR INSERT TO authenticated WITH CHECK (can_write());

CREATE POLICY "social_metrics_delete" ON public.social_metrics
  FOR DELETE TO authenticated USING (is_admin());

CREATE TABLE public.social_engagers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.social_discovery_profiles(id) ON DELETE CASCADE,
  username text NOT NULL,
  total_comentarios integer DEFAULT 0,
  frequencia_interacao text,
  ultima_interacao timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.social_engagers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "social_engagers_select" ON public.social_engagers
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "social_engagers_insert" ON public.social_engagers
  FOR INSERT TO authenticated WITH CHECK (can_write());

CREATE POLICY "social_engagers_delete" ON public.social_engagers
  FOR DELETE TO authenticated USING (is_admin());

CREATE TRIGGER update_system_api_credentials_updated_at
  BEFORE UPDATE ON public.system_api_credentials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_social_discovery_profiles_updated_at
  BEFORE UPDATE ON public.social_discovery_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
