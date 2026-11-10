-- Exportação sem dados: somente estrutura e lógica.
CREATE POLICY "social_engagers_update"
ON public.social_engagers
FOR UPDATE
TO authenticated
USING (can_write());
