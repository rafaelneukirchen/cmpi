-- Exportação sem dados: somente estrutura e lógica.
CREATE TABLE public.coordenador_cidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  cidade_id uuid NOT NULL REFERENCES public.cidades(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, cidade_id)
);

ALTER TABLE public.coordenador_cidades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coordenador_cidades_select" ON public.coordenador_cidades
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "coordenador_cidades_insert" ON public.coordenador_cidades
  FOR INSERT TO authenticated WITH CHECK (is_admin());

CREATE POLICY "coordenador_cidades_update" ON public.coordenador_cidades
  FOR UPDATE TO authenticated USING (is_admin());

CREATE POLICY "coordenador_cidades_delete" ON public.coordenador_cidades
  FOR DELETE TO authenticated USING (is_admin());
