-- Exportação sem dados: somente estrutura e lógica.
CREATE TABLE public.social_competitors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT,
  partido TEXT,
  cargo TEXT,
  observacoes TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_competitors TO authenticated;

GRANT ALL ON public.social_competitors TO service_role;

ALTER TABLE public.social_competitors ENABLE ROW LEVEL SECURITY;

CREATE POLICY social_competitors_select ON public.social_competitors
  FOR SELECT TO authenticated USING (true);

CREATE POLICY social_competitors_insert ON public.social_competitors
  FOR INSERT TO authenticated WITH CHECK (is_admin());

CREATE POLICY social_competitors_update ON public.social_competitors
  FOR UPDATE TO authenticated USING (is_admin());

CREATE POLICY social_competitors_delete ON public.social_competitors
  FOR DELETE TO authenticated USING (is_admin());

CREATE TRIGGER trg_social_competitors_updated
  BEFORE UPDATE ON public.social_competitors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.social_competitor_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  competitor_id UUID NOT NULL REFERENCES public.social_competitors(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  followers INTEGER NOT NULL DEFAULT 0,
  follows INTEGER NOT NULL DEFAULT 0,
  media_count INTEGER NOT NULL DEFAULT 0,
  total_likes INTEGER NOT NULL DEFAULT 0,
  total_comments INTEGER NOT NULL DEFAULT 0,
  avg_engagement NUMERIC NOT NULL DEFAULT 0,
  top_posts JSONB NOT NULL DEFAULT '[]'::jsonb,
  themes JSONB NOT NULL DEFAULT '[]'::jsonb,
  profile_picture_url TEXT,
  biography TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (competitor_id, snapshot_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.social_competitor_snapshots TO authenticated;

GRANT ALL ON public.social_competitor_snapshots TO service_role;

ALTER TABLE public.social_competitor_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY scs_select ON public.social_competitor_snapshots
  FOR SELECT TO authenticated USING (true);

CREATE POLICY scs_insert ON public.social_competitor_snapshots
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY scs_update ON public.social_competitor_snapshots
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);

CREATE POLICY scs_delete ON public.social_competitor_snapshots
  FOR DELETE TO authenticated USING (is_admin());

CREATE INDEX idx_scs_competitor_date ON public.social_competitor_snapshots(competitor_id, snapshot_date DESC);
