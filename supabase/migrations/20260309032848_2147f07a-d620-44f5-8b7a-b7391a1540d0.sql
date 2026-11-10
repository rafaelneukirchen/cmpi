-- Exportação sem dados: somente estrutura e lógica.
CREATE TABLE public.campanhas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  ano integer NOT NULL,
  status text NOT NULL DEFAULT 'ativa',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.campanhas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "campanhas_select" ON public.campanhas FOR SELECT TO authenticated USING (true);

CREATE POLICY "campanhas_insert" ON public.campanhas FOR INSERT TO authenticated WITH CHECK (is_admin());

CREATE POLICY "campanhas_update" ON public.campanhas FOR UPDATE TO authenticated USING (is_admin());

CREATE POLICY "campanhas_delete" ON public.campanhas FOR DELETE TO authenticated USING (is_admin());

CREATE TABLE public.campanhas_arquivo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campanha_id uuid REFERENCES public.campanhas(id) ON DELETE CASCADE NOT NULL,
  tabela text NOT NULL,
  dados jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.campanhas_arquivo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "campanhas_arquivo_select" ON public.campanhas_arquivo FOR SELECT TO authenticated USING (is_admin());

CREATE POLICY "campanhas_arquivo_insert" ON public.campanhas_arquivo FOR INSERT TO authenticated WITH CHECK (is_admin());
