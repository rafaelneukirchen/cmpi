-- Exportação sem dados: somente estrutura e lógica.
CREATE TABLE public.instagram_daily_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  followers INTEGER NOT NULL DEFAULT 0,
  following INTEGER NOT NULL DEFAULT 0,
  media_count INTEGER NOT NULL DEFAULT 0,
  profile_views INTEGER NOT NULL DEFAULT 0,
  total_likes INTEGER NOT NULL DEFAULT 0,
  total_comments INTEGER NOT NULL DEFAULT 0,
  total_reach INTEGER NOT NULL DEFAULT 0,
  total_impressions INTEGER NOT NULL DEFAULT 0,
  total_saves INTEGER NOT NULL DEFAULT 0,
  total_shares INTEGER NOT NULL DEFAULT 0,
  total_posts INTEGER NOT NULL DEFAULT 0,
  avg_engagement NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(snapshot_date)
);

ALTER TABLE public.instagram_daily_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ig_snapshots_select"
ON public.instagram_daily_snapshots
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "ig_snapshots_insert"
ON public.instagram_daily_snapshots
FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "ig_snapshots_update"
ON public.instagram_daily_snapshots
FOR UPDATE TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "ig_snapshots_delete"
ON public.instagram_daily_snapshots
FOR DELETE TO authenticated
USING (is_admin());

CREATE INDEX idx_ig_snapshots_date ON public.instagram_daily_snapshots(snapshot_date DESC);

CREATE TRIGGER update_ig_snapshots_updated_at
BEFORE UPDATE ON public.instagram_daily_snapshots
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
