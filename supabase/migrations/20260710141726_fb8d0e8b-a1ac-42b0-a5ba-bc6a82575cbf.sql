-- Exportação sem dados: somente estrutura e lógica.
ALTER TABLE public.cabos_eleitorais
  ADD COLUMN IF NOT EXISTS bairros text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS cidades_representadas uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS votos_por_cidade jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS zonas_por_cidade jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS forca_politica text NOT NULL DEFAULT 'media',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'potencial',
  ADD COLUMN IF NOT EXISTS coordenador_user_id uuid,
  ADD COLUMN IF NOT EXISTS historico_politico text;
