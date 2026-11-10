-- Exportação sem dados: somente estrutura e lógica.
CREATE OR REPLACE FUNCTION public.generate_license_key()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  segment TEXT;
  result TEXT := 'INTEL';
  i INT;
  j INT;
  exists_check INT;
BEGIN
  LOOP
    result := 'INTEL';
    FOR i IN 1..3 LOOP
      segment := '';
      FOR j IN 1..4 LOOP
        segment := segment || substr(chars, (floor(random() * length(chars)) + 1)::int, 1);
      END LOOP;
      result := result || '-' || segment;
    END LOOP;
    SELECT count(*) INTO exists_check FROM public.licencas WHERE chave_licenca = result;
    EXIT WHEN exists_check = 0;
  END LOOP;
  RETURN result;
END;
$$;

CREATE TABLE public.licencas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chave_licenca TEXT NOT NULL UNIQUE,
  cliente_nome TEXT NOT NULL,
  cliente_email TEXT,
  cliente_telefone TEXT,
  cliente_empresa TEXT,
  plano TEXT NOT NULL DEFAULT 'basico',
  status TEXT NOT NULL DEFAULT 'ativa',
  data_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  data_validade DATE,
  valor_pago NUMERIC(10,2) DEFAULT 0,
  forma_pagamento TEXT,
  url_projeto TEXT,
  observacoes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.set_license_key()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.chave_licenca IS NULL OR NEW.chave_licenca = '' THEN
    NEW.chave_licenca := public.generate_license_key();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_license_key
BEFORE INSERT ON public.licencas
FOR EACH ROW
EXECUTE FUNCTION public.set_license_key();

CREATE TRIGGER trg_licencas_updated_at
BEFORE UPDATE ON public.licencas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.licencas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "licencas_select_super_admin"
ON public.licencas FOR SELECT TO authenticated
USING (is_super_admin());

CREATE POLICY "licencas_insert_super_admin"
ON public.licencas FOR INSERT TO authenticated
WITH CHECK (is_super_admin());

CREATE POLICY "licencas_update_super_admin"
ON public.licencas FOR UPDATE TO authenticated
USING (is_super_admin());

CREATE POLICY "licencas_delete_super_admin"
ON public.licencas FOR DELETE TO authenticated
USING (is_super_admin());

CREATE INDEX idx_licencas_status ON public.licencas(status);

CREATE INDEX idx_licencas_validade ON public.licencas(data_validade);
