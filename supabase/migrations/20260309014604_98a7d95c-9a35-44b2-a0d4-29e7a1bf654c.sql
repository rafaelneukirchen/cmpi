-- Exportação sem dados: somente estrutura e lógica.
CREATE TYPE public.forca_politica AS ENUM ('baixa', 'media', 'alta');

CREATE TYPE public.status_lideranca AS ENUM ('ativa', 'potencial', 'em_negociacao');

CREATE TYPE public.nivel_confianca AS ENUM ('baixo', 'medio', 'alto');

CREATE TYPE public.tipo_evento AS ENUM ('reuniao', 'comicio', 'visita', 'carreata', 'debate');

CREATE TYPE public.app_role AS ENUM ('admin', 'coordenador_estadual', 'coordenador_regional', 'operador_cadastro', 'analista_eleitoral');

CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.can_write()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin', 'coordenador_estadual', 'coordenador_regional', 'operador_cadastro')
  )
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'admin'
  )
$$;

CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    nome TEXT NOT NULL,
    email TEXT NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.estados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    sigla CHAR(2) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.estados ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.cidades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    estado_id UUID REFERENCES public.estados(id) ON DELETE CASCADE NOT NULL,
    regiao_administrativa TEXT,
    populacao INTEGER DEFAULT 0,
    eleitores INTEGER DEFAULT 0,
    densidade_populacional NUMERIC(10,2) DEFAULT 0,
    pib_municipal NUMERIC(15,2) DEFAULT 0,
    latitude NUMERIC(10,6),
    longitude NUMERIC(10,6),
    area_territorial NUMERIC(12,2),
    observacoes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.cidades ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.liderancas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    telefone TEXT,
    whatsapp TEXT,
    cidade_base_id UUID REFERENCES public.cidades(id) ON DELETE SET NULL,
    cidades_representadas UUID[] DEFAULT '{}',
    forca_politica forca_politica NOT NULL DEFAULT 'media',
    status status_lideranca NOT NULL DEFAULT 'potencial',
    historico_politico TEXT,
    observacoes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.liderancas ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.projecao_votos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cidade_id UUID REFERENCES public.cidades(id) ON DELETE CASCADE NOT NULL,
    lideranca_id UUID REFERENCES public.liderancas(id) ON DELETE SET NULL,
    votos_projetados INTEGER DEFAULT 0,
    votos_confirmados INTEGER DEFAULT 0,
    meta_votos INTEGER DEFAULT 0,
    nivel_confianca nivel_confianca NOT NULL DEFAULT 'medio',
    data_atualizacao DATE DEFAULT CURRENT_DATE,
    responsavel TEXT,
    observacoes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.projecao_votos ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.estrutura_campanha (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cidade_id UUID REFERENCES public.cidades(id) ON DELETE CASCADE NOT NULL UNIQUE,
    cabos_eleitorais INTEGER DEFAULT 0,
    apoiadores INTEGER DEFAULT 0,
    veiculos INTEGER DEFAULT 0,
    materiais_distribuidos INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.estrutura_campanha ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.visitas_campanha (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cidade_id UUID REFERENCES public.cidades(id) ON DELETE CASCADE NOT NULL,
    lideranca_id UUID REFERENCES public.liderancas(id) ON DELETE SET NULL,
    data_visita DATE NOT NULL,
    equipe_responsavel TEXT,
    objetivo TEXT,
    resultado TEXT,
    relatorio TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.visitas_campanha ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.agenda_campanha (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cidade_id UUID REFERENCES public.cidades(id) ON DELETE CASCADE NOT NULL,
    evento TEXT NOT NULL,
    data TIMESTAMP WITH TIME ZONE NOT NULL,
    responsavel TEXT,
    tipo_evento tipo_evento NOT NULL DEFAULT 'reuniao',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.agenda_campanha ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cidades_updated_at BEFORE UPDATE ON public.cidades FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_liderancas_updated_at BEFORE UPDATE ON public.liderancas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_projecao_votos_updated_at BEFORE UPDATE ON public.projecao_votos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_estrutura_campanha_updated_at BEFORE UPDATE ON public.estrutura_campanha FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_visitas_campanha_updated_at BEFORE UPDATE ON public.visitas_campanha FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_agenda_campanha_updated_at BEFORE UPDATE ON public.agenda_campanha FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "user_roles_select" ON public.user_roles
    FOR SELECT TO authenticated
    USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "user_roles_insert" ON public.user_roles
    FOR INSERT TO authenticated
    WITH CHECK (public.is_admin());

CREATE POLICY "user_roles_update" ON public.user_roles
    FOR UPDATE TO authenticated
    USING (public.is_admin());

CREATE POLICY "user_roles_delete" ON public.user_roles
    FOR DELETE TO authenticated
    USING (public.is_admin());

CREATE POLICY "profiles_select" ON public.profiles
    FOR SELECT TO authenticated
    USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "profiles_update" ON public.profiles
    FOR UPDATE TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "profiles_insert" ON public.profiles
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "estados_select" ON public.estados
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "estados_insert" ON public.estados
    FOR INSERT TO authenticated
    WITH CHECK (public.is_admin());

CREATE POLICY "estados_update" ON public.estados
    FOR UPDATE TO authenticated
    USING (public.is_admin());

CREATE POLICY "estados_delete" ON public.estados
    FOR DELETE TO authenticated
    USING (public.is_admin());

CREATE POLICY "cidades_select" ON public.cidades
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "cidades_insert" ON public.cidades
    FOR INSERT TO authenticated
    WITH CHECK (public.can_write());

CREATE POLICY "cidades_update" ON public.cidades
    FOR UPDATE TO authenticated
    USING (public.can_write());

CREATE POLICY "cidades_delete" ON public.cidades
    FOR DELETE TO authenticated
    USING (public.is_admin());

CREATE POLICY "liderancas_select" ON public.liderancas
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "liderancas_insert" ON public.liderancas
    FOR INSERT TO authenticated
    WITH CHECK (public.can_write());

CREATE POLICY "liderancas_update" ON public.liderancas
    FOR UPDATE TO authenticated
    USING (public.can_write());

CREATE POLICY "liderancas_delete" ON public.liderancas
    FOR DELETE TO authenticated
    USING (public.is_admin());

CREATE POLICY "projecao_votos_select" ON public.projecao_votos
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "projecao_votos_insert" ON public.projecao_votos
    FOR INSERT TO authenticated
    WITH CHECK (public.can_write());

CREATE POLICY "projecao_votos_update" ON public.projecao_votos
    FOR UPDATE TO authenticated
    USING (public.can_write());

CREATE POLICY "projecao_votos_delete" ON public.projecao_votos
    FOR DELETE TO authenticated
    USING (public.is_admin());

CREATE POLICY "estrutura_campanha_select" ON public.estrutura_campanha
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "estrutura_campanha_insert" ON public.estrutura_campanha
    FOR INSERT TO authenticated
    WITH CHECK (public.can_write());

CREATE POLICY "estrutura_campanha_update" ON public.estrutura_campanha
    FOR UPDATE TO authenticated
    USING (public.can_write());

CREATE POLICY "estrutura_campanha_delete" ON public.estrutura_campanha
    FOR DELETE TO authenticated
    USING (public.is_admin());

CREATE POLICY "visitas_campanha_select" ON public.visitas_campanha
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "visitas_campanha_insert" ON public.visitas_campanha
    FOR INSERT TO authenticated
    WITH CHECK (public.can_write());

CREATE POLICY "visitas_campanha_update" ON public.visitas_campanha
    FOR UPDATE TO authenticated
    USING (public.can_write());

CREATE POLICY "visitas_campanha_delete" ON public.visitas_campanha
    FOR DELETE TO authenticated
    USING (public.is_admin());

CREATE POLICY "agenda_campanha_select" ON public.agenda_campanha
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "agenda_campanha_insert" ON public.agenda_campanha
    FOR INSERT TO authenticated
    WITH CHECK (public.can_write());

CREATE POLICY "agenda_campanha_update" ON public.agenda_campanha
    FOR UPDATE TO authenticated
    USING (public.can_write());

CREATE POLICY "agenda_campanha_delete" ON public.agenda_campanha
    FOR DELETE TO authenticated
    USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (user_id, nome, email)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
        NEW.email
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE INDEX idx_cidades_estado ON public.cidades(estado_id);

CREATE INDEX idx_liderancas_cidade_base ON public.liderancas(cidade_base_id);

CREATE INDEX idx_projecao_votos_cidade ON public.projecao_votos(cidade_id);

CREATE INDEX idx_projecao_votos_lideranca ON public.projecao_votos(lideranca_id);

CREATE INDEX idx_estrutura_campanha_cidade ON public.estrutura_campanha(cidade_id);

CREATE INDEX idx_visitas_campanha_cidade ON public.visitas_campanha(cidade_id);

CREATE INDEX idx_agenda_campanha_cidade ON public.agenda_campanha(cidade_id);

CREATE INDEX idx_agenda_campanha_data ON public.agenda_campanha(data);
