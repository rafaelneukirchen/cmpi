-- Exportação sem dados: somente estrutura e lógica.
CREATE TABLE public.contatos_coordenacao (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  coordenador_user_id UUID NOT NULL,
  registrado_por_user_id UUID NOT NULL,
  data_contato TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  tipo_contato TEXT NOT NULL DEFAULT 'ligacao',
  assunto TEXT NOT NULL,
  relatorio TEXT,
  proximos_passos TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_contatos_coordenacao_coord ON public.contatos_coordenacao(coordenador_user_id, data_contato DESC);

ALTER TABLE public.contatos_coordenacao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contatos_coordenacao_select"
  ON public.contatos_coordenacao FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "contatos_coordenacao_insert"
  ON public.contatos_coordenacao FOR INSERT
  TO authenticated
  WITH CHECK (is_admin() AND registrado_por_user_id = auth.uid());

CREATE POLICY "contatos_coordenacao_update"
  ON public.contatos_coordenacao FOR UPDATE
  TO authenticated
  USING (is_admin());

CREATE POLICY "contatos_coordenacao_delete"
  ON public.contatos_coordenacao FOR DELETE
  TO authenticated
  USING (is_admin());

CREATE TRIGGER trg_contatos_coordenacao_updated_at
  BEFORE UPDATE ON public.contatos_coordenacao
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
