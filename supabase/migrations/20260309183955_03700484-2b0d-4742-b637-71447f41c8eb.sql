-- Exportação sem dados: somente estrutura e lógica.
ALTER TABLE public.cidades
  ADD COLUMN coordenador_nome text,
  ADD COLUMN coordenador_telefone text,
  ADD COLUMN coordenador_whatsapp text,
  ADD COLUMN coordenador_funcao text;
