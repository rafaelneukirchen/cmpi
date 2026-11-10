-- Exportação sem dados: somente estrutura e lógica.
ALTER TABLE public.planejamento_logistico ADD COLUMN IF NOT EXISTS coordenador_user_id uuid;

ALTER TABLE public.planejamento_logistico DROP CONSTRAINT IF EXISTS planejamento_logistico_cidade_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS planejamento_logistico_cidade_coord_uidx
  ON public.planejamento_logistico (cidade_id, COALESCE(coordenador_user_id,'00000000-0000-0000-0000-000000000000'::uuid));
