-- Exportação sem dados: somente estrutura e lógica.
CREATE SEQUENCE IF NOT EXISTS public.material_requests_numero_seq START WITH 1001;

ALTER TABLE public.material_requests
  ADD COLUMN IF NOT EXISTS numero_pedido bigint NOT NULL DEFAULT nextval('public.material_requests_numero_seq');

CREATE UNIQUE INDEX IF NOT EXISTS material_requests_numero_pedido_key ON public.material_requests (numero_pedido);

ALTER TABLE public.material_requests REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'material_requests'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.material_requests';
  END IF;
END $$;
