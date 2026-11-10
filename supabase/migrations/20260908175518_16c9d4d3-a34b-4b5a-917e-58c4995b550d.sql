-- Exportação sem dados: somente estrutura e lógica.
CREATE UNIQUE INDEX IF NOT EXISTS user_permissions_user_module_uidx
  ON public.user_permissions (user_id, module);
