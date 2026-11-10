-- Exportação sem dados: somente estrutura e lógica.
ALTER TABLE public.planejamento_logistico
  ADD COLUMN IF NOT EXISTS wind_banner integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS praguinha integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS panfleto integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS flayer integer DEFAULT 0;
