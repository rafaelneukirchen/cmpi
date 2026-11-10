-- Exportação sem dados: somente estrutura e lógica.
CREATE TABLE public.material_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitante_user_id uuid,
  coordenador_nome text NOT NULL,
  material_id uuid REFERENCES public.materials(id) ON DELETE SET NULL,
  material_nome text,
  quantidade_solicitada integer NOT NULL DEFAULT 1,
  quantidade_atendida integer NOT NULL DEFAULT 0,
  cidade_destino text NOT NULL,
  cidade_id uuid REFERENCES public.cidades(id) ON DELETE SET NULL,
  lideranca_id uuid REFERENCES public.liderancas(id) ON DELETE SET NULL,
  lideranca_nome text,
  prioridade text NOT NULL DEFAULT 'Normal',
  status text NOT NULL DEFAULT 'Pendente',
  observacoes text,
  resposta_logistica text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.material_requests TO authenticated;

GRANT ALL ON public.material_requests TO service_role;

ALTER TABLE public.material_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mr_select" ON public.material_requests FOR SELECT TO authenticated
USING (public.is_admin() OR public.is_coordinator() OR solicitante_user_id = auth.uid());

CREATE POLICY "mr_insert" ON public.material_requests FOR INSERT TO authenticated
WITH CHECK (solicitante_user_id = auth.uid());

CREATE POLICY "mr_update" ON public.material_requests FOR UPDATE TO authenticated
USING (public.is_admin() OR public.is_coordinator() OR (solicitante_user_id = auth.uid() AND status = 'Pendente'))
WITH CHECK (public.is_admin() OR public.is_coordinator() OR (solicitante_user_id = auth.uid() AND status = 'Pendente'));

CREATE POLICY "mr_delete" ON public.material_requests FOR DELETE TO authenticated
USING (public.is_admin());

CREATE TRIGGER update_material_requests_updated_at
BEFORE UPDATE ON public.material_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_material_requests_status ON public.material_requests(status);
