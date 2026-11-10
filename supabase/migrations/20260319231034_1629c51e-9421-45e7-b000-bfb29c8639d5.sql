-- Exportação sem dados: somente estrutura e lógica.
CREATE TABLE IF NOT EXISTS public.tse_candidatos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_urna text NOT NULL,
  nome_completo text,
  cpf text,
  numero_candidato text NOT NULL,
  cargo text NOT NULL,
  sigla_partido text,
  nome_partido text,
  municipio text,
  codigo_municipio text,
  ano_eleicao integer NOT NULL DEFAULT 2024,
  situacao text,
  total_votos integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tse_candidatos_municipio ON public.tse_candidatos (municipio);

CREATE INDEX IF NOT EXISTS idx_tse_candidatos_ano ON public.tse_candidatos (ano_eleicao);

CREATE INDEX IF NOT EXISTS idx_tse_candidatos_nome_lower ON public.tse_candidatos (lower(nome_urna));

CREATE TABLE IF NOT EXISTS public.tse_votos_municipio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidato_id uuid REFERENCES public.tse_candidatos(id) ON DELETE CASCADE,
  municipio text NOT NULL,
  codigo_municipio text,
  zona_eleitoral text,
  total_votos integer DEFAULT 0,
  ano_eleicao integer NOT NULL DEFAULT 2024,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tse_votos_candidato ON public.tse_votos_municipio (candidato_id);

CREATE INDEX IF NOT EXISTS idx_tse_votos_municipio ON public.tse_votos_municipio (municipio);

ALTER TABLE public.tse_candidatos ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.tse_votos_municipio ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tse_candidatos' AND policyname = 'tse_candidatos_select') THEN
    CREATE POLICY "tse_candidatos_select" ON public.tse_candidatos FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tse_votos_municipio' AND policyname = 'tse_votos_municipio_select') THEN
    CREATE POLICY "tse_votos_municipio_select" ON public.tse_votos_municipio FOR SELECT TO authenticated USING (true);
  END IF;
END $$;
