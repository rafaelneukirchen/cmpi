-- Exportação sem dados: somente estrutura e lógica.
CREATE TABLE public.user_location_consent (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  consented_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  revoked_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  frequency_minutes INTEGER NOT NULL DEFAULT 15,
  terms_version TEXT NOT NULL DEFAULT 'v1',
  terms_text TEXT,
  device_info TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.user_location_consent ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_consent_select_own_or_admin"
ON public.user_location_consent FOR SELECT TO authenticated
USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "user_consent_insert_own"
ON public.user_location_consent FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_consent_update_own"
ON public.user_location_consent FOR UPDATE TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "user_consent_delete_admin"
ON public.user_location_consent FOR DELETE TO authenticated
USING (is_admin());

CREATE TRIGGER update_user_location_consent_updated_at
BEFORE UPDATE ON public.user_location_consent
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.user_locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  accuracy DOUBLE PRECISION,
  speed DOUBLE PRECISION,
  heading DOUBLE PRECISION,
  altitude DOUBLE PRECISION,
  battery_level INTEGER,
  is_moving BOOLEAN,
  captured_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.user_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_locations_select_own_or_admin"
ON public.user_locations FOR SELECT TO authenticated
USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "user_locations_insert_own_with_consent"
ON public.user_locations FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.user_location_consent
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE INDEX idx_user_locations_user_captured ON public.user_locations(user_id, captured_at DESC);

CREATE INDEX idx_user_locations_captured_at ON public.user_locations(captured_at DESC);

CREATE OR REPLACE FUNCTION public.get_latest_user_locations()
RETURNS TABLE (
  user_id UUID,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  accuracy DOUBLE PRECISION,
  battery_level INTEGER,
  captured_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT ON (ul.user_id)
    ul.user_id, ul.latitude, ul.longitude, ul.accuracy, ul.battery_level, ul.captured_at
  FROM public.user_locations ul
  WHERE is_admin() OR ul.user_id = auth.uid()
  ORDER BY ul.user_id, ul.captured_at DESC;
$$;
