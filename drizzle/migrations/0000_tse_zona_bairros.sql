CREATE TABLE public.tse_zona_bairros (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), municipio text NOT NULL, zona integer NOT NULL, bairros text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (municipio, zona));
GRANT SELECT ON public.tse_zona_bairros TO authenticated;
GRANT ALL ON public.tse_zona_bairros TO service_role;
ALTER TABLE public.tse_zona_bairros ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados leem bairros das zonas" ON public.tse_zona_bairros FOR SELECT TO authenticated USING (true);