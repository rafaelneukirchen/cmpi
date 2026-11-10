-- Exportação sem dados: somente estrutura e lógica.
CREATE TABLE public.public_map_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  label text,
  expires_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.public_map_links TO authenticated;

GRANT ALL ON public.public_map_links TO service_role;

ALTER TABLE public.public_map_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY public_map_links_select ON public.public_map_links
  FOR SELECT TO authenticated USING (is_admin());

CREATE POLICY public_map_links_insert ON public.public_map_links
  FOR INSERT TO authenticated WITH CHECK (is_admin() AND (created_by = auth.uid() OR created_by IS NULL));

CREATE POLICY public_map_links_update ON public.public_map_links
  FOR UPDATE TO authenticated USING (is_admin());

CREATE POLICY public_map_links_delete ON public.public_map_links
  FOR DELETE TO authenticated USING (is_admin());

CREATE TRIGGER trg_public_map_links_updated
  BEFORE UPDATE ON public.public_map_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.generate_public_map_token()
RETURNS text LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  new_token text;
  exists_check int;
BEGIN
  LOOP
    new_token := lower(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 16));
    SELECT count(*) INTO exists_check FROM public.public_map_links WHERE token = new_token;
    EXIT WHEN exists_check = 0;
  END LOOP;
  RETURN new_token;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_public_map_token()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.token IS NULL OR length(trim(NEW.token)) = 0 THEN
    NEW.token := public.generate_public_map_token();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_public_map_links_token
  BEFORE INSERT ON public.public_map_links
  FOR EACH ROW EXECUTE FUNCTION public.set_public_map_token();

CREATE OR REPLACE FUNCTION public.get_public_map_data(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link record;
  v_result jsonb;
BEGIN
  SELECT id, active, expires_at INTO v_link
  FROM public.public_map_links
  WHERE token = lower(trim(p_token))
  LIMIT 1;

  IF v_link.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Link inválido');
  END IF;
  IF NOT v_link.active THEN
    RETURN jsonb_build_object('success', false, 'error', 'Link desativado');
  END IF;
  IF v_link.expires_at IS NOT NULL AND v_link.expires_at < now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Link expirado');
  END IF;

  WITH cidades_data AS (
    SELECT
      c.id,
      c.nome,
      c.regiao_administrativa,
      c.latitude,
      c.longitude,
      c.coordenador_cor,
      c.coordenador_nome,
      (
        SELECT jsonb_agg(jsonb_build_object(
          'candidato_parceiro', d.candidato_parceiro,
          'cargo_parceiro', d.cargo_parceiro
        ))
        FROM public.dobradinhas d
        LEFT JOIN public.liderancas l ON l.id = d.lideranca_id
        WHERE COALESCE(d.cidade_id, l.cidade_base_id) = c.id
      ) AS dobradinhas
    FROM public.cidades c
  )
  SELECT jsonb_build_object(
    'success', true,
    'cidades', COALESCE(jsonb_agg(to_jsonb(cidades_data)), '[]'::jsonb)
  ) INTO v_result
  FROM cidades_data;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_map_data(text) TO anon, authenticated;
