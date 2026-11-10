-- Exportação sem dados: somente estrutura e lógica.
CREATE TABLE public.pontos_entrega (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  coordenador_user_id uuid,
  cidade_id uuid REFERENCES public.cidades(id) ON DELETE SET NULL,
  endereco text NOT NULL,
  bairro text,
  cep text,
  referencia text,
  responsavel_nome text,
  responsavel_telefone text,
  latitude double precision,
  longitude double precision,
  ativo boolean NOT NULL DEFAULT true,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pontos_entrega TO authenticated;

GRANT ALL ON public.pontos_entrega TO service_role;

ALTER TABLE public.pontos_entrega ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pontos_entrega_select" ON public.pontos_entrega FOR SELECT TO authenticated USING (true);

CREATE POLICY "pontos_entrega_insert" ON public.pontos_entrega FOR INSERT TO authenticated WITH CHECK (public.can_write());

CREATE POLICY "pontos_entrega_update" ON public.pontos_entrega FOR UPDATE TO authenticated USING (public.can_write()) WITH CHECK (public.can_write());

CREATE POLICY "pontos_entrega_delete" ON public.pontos_entrega FOR DELETE TO authenticated USING (public.can_write());

CREATE TABLE public.rotas_entrega (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  data_saida date NOT NULL DEFAULT CURRENT_DATE,
  origem_endereco text NOT NULL DEFAULT 'Rua Bom Pastor, 2224, São Paulo - SP',
  origem_latitude double precision,
  origem_longitude double precision,
  motorista text,
  veiculo text,
  status text NOT NULL DEFAULT 'planejada',
  distancia_total_metros double precision,
  duracao_total_segundos integer,
  observacoes text,
  criado_por_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rotas_entrega TO authenticated;

GRANT ALL ON public.rotas_entrega TO service_role;

ALTER TABLE public.rotas_entrega ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rotas_entrega_select" ON public.rotas_entrega FOR SELECT TO authenticated USING (true);

CREATE POLICY "rotas_entrega_insert" ON public.rotas_entrega FOR INSERT TO authenticated WITH CHECK (public.can_write());

CREATE POLICY "rotas_entrega_update" ON public.rotas_entrega FOR UPDATE TO authenticated USING (public.can_write()) WITH CHECK (public.can_write());

CREATE POLICY "rotas_entrega_delete" ON public.rotas_entrega FOR DELETE TO authenticated USING (public.can_write());

CREATE TABLE public.rota_paradas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rota_id uuid NOT NULL REFERENCES public.rotas_entrega(id) ON DELETE CASCADE,
  ponto_entrega_id uuid REFERENCES public.pontos_entrega(id) ON DELETE SET NULL,
  cidade_id uuid REFERENCES public.cidades(id) ON DELETE SET NULL,
  material_request_id uuid REFERENCES public.material_requests(id) ON DELETE SET NULL,
  titulo text NOT NULL,
  endereco text NOT NULL,
  contato_nome text,
  contato_telefone text,
  latitude double precision,
  longitude double precision,
  ordem integer NOT NULL DEFAULT 0,
  distancia_metros double precision,
  duracao_segundos integer,
  entregue boolean NOT NULL DEFAULT false,
  entregue_em timestamptz,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rota_paradas TO authenticated;

GRANT ALL ON public.rota_paradas TO service_role;

ALTER TABLE public.rota_paradas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rota_paradas_select" ON public.rota_paradas FOR SELECT TO authenticated USING (true);

CREATE POLICY "rota_paradas_insert" ON public.rota_paradas FOR INSERT TO authenticated WITH CHECK (public.can_write());

CREATE POLICY "rota_paradas_update" ON public.rota_paradas FOR UPDATE TO authenticated USING (public.can_write()) WITH CHECK (public.can_write());

CREATE POLICY "rota_paradas_delete" ON public.rota_paradas FOR DELETE TO authenticated USING (public.can_write());

CREATE TABLE public.rota_parada_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parada_id uuid NOT NULL REFERENCES public.rota_paradas(id) ON DELETE CASCADE,
  material_id uuid REFERENCES public.materials(id) ON DELETE SET NULL,
  material_nome text NOT NULL,
  quantidade integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rota_parada_itens TO authenticated;

GRANT ALL ON public.rota_parada_itens TO service_role;

ALTER TABLE public.rota_parada_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rota_parada_itens_select" ON public.rota_parada_itens FOR SELECT TO authenticated USING (true);

CREATE POLICY "rota_parada_itens_insert" ON public.rota_parada_itens FOR INSERT TO authenticated WITH CHECK (public.can_write());

CREATE POLICY "rota_parada_itens_update" ON public.rota_parada_itens FOR UPDATE TO authenticated USING (public.can_write()) WITH CHECK (public.can_write());

CREATE POLICY "rota_parada_itens_delete" ON public.rota_parada_itens FOR DELETE TO authenticated USING (public.can_write());

CREATE INDEX idx_rota_paradas_rota ON public.rota_paradas(rota_id, ordem);

CREATE INDEX idx_rota_parada_itens_parada ON public.rota_parada_itens(parada_id);

CREATE INDEX idx_pontos_entrega_cidade ON public.pontos_entrega(cidade_id);

CREATE TRIGGER update_pontos_entrega_updated_at BEFORE UPDATE ON public.pontos_entrega FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_rotas_entrega_updated_at BEFORE UPDATE ON public.rotas_entrega FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_rota_paradas_updated_at BEFORE UPDATE ON public.rota_paradas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
