-- Exportação sem dados: somente estrutura e lógica.
CREATE TABLE public.dobradinhas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cidade_id uuid NOT NULL REFERENCES public.cidades(id) ON DELETE CASCADE,
  lideranca_id uuid REFERENCES public.liderancas(id) ON DELETE SET NULL,
  candidato_parceiro text NOT NULL,
  cargo_parceiro text,
  votos_estimados integer DEFAULT 0,
  observacoes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.dobradinhas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dobradinhas_select" ON public.dobradinhas FOR SELECT TO authenticated USING (true);

CREATE POLICY "dobradinhas_insert" ON public.dobradinhas FOR INSERT TO authenticated WITH CHECK (can_write());

CREATE POLICY "dobradinhas_update" ON public.dobradinhas FOR UPDATE TO authenticated USING (can_write());

CREATE POLICY "dobradinhas_delete" ON public.dobradinhas FOR DELETE TO authenticated USING (is_admin());
