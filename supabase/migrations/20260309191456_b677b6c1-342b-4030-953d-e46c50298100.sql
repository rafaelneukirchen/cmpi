-- Exportação sem dados: somente estrutura e lógica.
ALTER TABLE public.liderancas
  ADD COLUMN coordenador_user_id uuid;
