-- Exportação sem dados: somente estrutura e lógica.
ALTER TABLE public.liderancas ADD COLUMN zonas_por_cidade jsonb DEFAULT '{}'::jsonb;
