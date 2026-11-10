-- Exportação sem dados: somente estrutura e lógica.
ALTER TABLE public.liderancas
ADD COLUMN IF NOT EXISTS votos_por_cidade jsonb DEFAULT '{}'::jsonb;
