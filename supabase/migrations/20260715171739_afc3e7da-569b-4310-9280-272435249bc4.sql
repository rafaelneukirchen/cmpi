-- Exportação sem dados: somente estrutura e lógica.
ALTER TABLE public.dobradinhas ADD COLUMN IF NOT EXISTS cabo_id uuid REFERENCES public.cabos_eleitorais(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_dobradinhas_cabo_id ON public.dobradinhas(cabo_id);
