-- Exportação sem dados: somente estrutura e lógica.
CREATE TABLE public.logistics_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  full_name text NOT NULL,
  cpf text,
  phone text,
  city text,
  neighborhood text,
  region text,
  management text,
  status text NOT NULL DEFAULT 'Ativo',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.logistics_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "logistics_profiles_select" ON public.logistics_profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "logistics_profiles_insert" ON public.logistics_profiles FOR INSERT TO authenticated WITH CHECK (can_write());

CREATE POLICY "logistics_profiles_update" ON public.logistics_profiles FOR UPDATE TO authenticated USING (can_write());

CREATE POLICY "logistics_profiles_delete" ON public.logistics_profiles FOR DELETE TO authenticated USING (is_admin());

CREATE TABLE public.materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL,
  total_qty integer NOT NULL DEFAULT 0,
  available_qty integer NOT NULL DEFAULT 0,
  distributed_qty integer NOT NULL DEFAULT 0,
  unit_price numeric NOT NULL DEFAULT 0,
  total_price numeric GENERATED ALWAYS AS (total_qty * unit_price) STORED,
  min_stock_qty integer NOT NULL DEFAULT 0,
  management text,
  city text,
  sent_date date,
  status text NOT NULL DEFAULT 'Disponível',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "materials_select" ON public.materials FOR SELECT TO authenticated USING (true);

CREATE POLICY "materials_insert" ON public.materials FOR INSERT TO authenticated WITH CHECK (can_write());

CREATE POLICY "materials_update" ON public.materials FOR UPDATE TO authenticated USING (can_write());

CREATE POLICY "materials_delete" ON public.materials FOR DELETE TO authenticated USING (is_admin());

CREATE TABLE public.movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id uuid NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  responsible_id uuid REFERENCES public.logistics_profiles(id),
  type text NOT NULL,
  quantity integer NOT NULL DEFAULT 0,
  city text,
  notes text,
  status text NOT NULL DEFAULT 'Confirmado',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "movements_select" ON public.movements FOR SELECT TO authenticated USING (true);

CREATE POLICY "movements_insert" ON public.movements FOR INSERT TO authenticated WITH CHECK (can_write());

CREATE POLICY "movements_update" ON public.movements FOR UPDATE TO authenticated USING (can_write());

CREATE POLICY "movements_delete" ON public.movements FOR DELETE TO authenticated USING (is_admin());

CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  table_name text,
  record_id text,
  user_id uuid,
  executor_name text,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_log_select" ON public.audit_log FOR SELECT TO authenticated USING (true);

CREATE POLICY "audit_log_insert" ON public.audit_log FOR INSERT TO authenticated WITH CHECK (true);

CREATE TABLE public.financial_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  description text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  category text,
  date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "financial_transactions_select" ON public.financial_transactions FOR SELECT TO authenticated USING (true);

CREATE POLICY "financial_transactions_insert" ON public.financial_transactions FOR INSERT TO authenticated WITH CHECK (can_write());

CREATE POLICY "financial_transactions_update" ON public.financial_transactions FOR UPDATE TO authenticated USING (can_write());

CREATE POLICY "financial_transactions_delete" ON public.financial_transactions FOR DELETE TO authenticated USING (is_admin());

CREATE TABLE public.reimbursements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  description text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Pendente',
  date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reimbursements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reimbursements_select" ON public.reimbursements FOR SELECT TO authenticated USING (true);

CREATE POLICY "reimbursements_insert" ON public.reimbursements FOR INSERT TO authenticated WITH CHECK (can_write());

CREATE POLICY "reimbursements_update" ON public.reimbursements FOR UPDATE TO authenticated USING (can_write());

CREATE POLICY "reimbursements_delete" ON public.reimbursements FOR DELETE TO authenticated USING (is_admin());

CREATE TABLE public.payment_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  description text NOT NULL,
  payee text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'Pendente',
  category text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_schedule_select" ON public.payment_schedule FOR SELECT TO authenticated USING (true);

CREATE POLICY "payment_schedule_insert" ON public.payment_schedule FOR INSERT TO authenticated WITH CHECK (can_write());

CREATE POLICY "payment_schedule_update" ON public.payment_schedule FOR UPDATE TO authenticated USING (can_write());

CREATE POLICY "payment_schedule_delete" ON public.payment_schedule FOR DELETE TO authenticated USING (is_admin());

CREATE OR REPLACE FUNCTION public.update_material_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.type = 'Entrada' THEN
    UPDATE public.materials SET available_qty = available_qty + NEW.quantity WHERE id = NEW.material_id;
  ELSIF NEW.type = 'Saída' THEN
    UPDATE public.materials SET available_qty = available_qty - NEW.quantity, distributed_qty = distributed_qty + NEW.quantity WHERE id = NEW.material_id;
  ELSIF NEW.type = 'Devolução' THEN
    UPDATE public.materials SET available_qty = available_qty + NEW.quantity, distributed_qty = GREATEST(0, distributed_qty - NEW.quantity) WHERE id = NEW.material_id;
  END IF;

  -- Update status
  UPDATE public.materials SET status = CASE
    WHEN available_qty <= 0 THEN 'Esgotado'
    WHEN min_stock_qty > 0 AND available_qty <= min_stock_qty THEN 'Disponível'
    ELSE 'Disponível'
  END WHERE id = NEW.material_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_material_stock
AFTER INSERT ON public.movements
FOR EACH ROW
EXECUTE FUNCTION public.update_material_stock();
