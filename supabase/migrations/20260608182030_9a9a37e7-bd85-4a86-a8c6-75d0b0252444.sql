-- Exportação sem dados: somente estrutura e lógica.
CREATE TABLE public.planejamento_logistico (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cidade_id uuid NOT NULL REFERENCES public.cidades(id) ON DELETE CASCADE,
  santinhos integer,
  adesivo_perfurado integer,
  adesivo_parachoque integer,
  observacoes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (cidade_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.planejamento_logistico TO authenticated;

GRANT ALL ON public.planejamento_logistico TO service_role;

ALTER TABLE public.planejamento_logistico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view planejamento"
  ON public.planejamento_logistico FOR SELECT TO authenticated USING (true);

CREATE POLICY "Writers can insert planejamento"
  ON public.planejamento_logistico FOR INSERT TO authenticated WITH CHECK (public.can_write());

CREATE POLICY "Writers can update planejamento"
  ON public.planejamento_logistico FOR UPDATE TO authenticated USING (public.can_write()) WITH CHECK (public.can_write());

CREATE POLICY "Admin can delete planejamento"
  ON public.planejamento_logistico FOR DELETE TO authenticated USING (public.is_admin());

CREATE TRIGGER update_planejamento_logistico_updated_at
  BEFORE UPDATE ON public.planejamento_logistico
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
