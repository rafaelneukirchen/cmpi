-- Exportação sem dados: somente estrutura e lógica.
CREATE POLICY "campo_midias_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'app-assets' AND (storage.foldername(name))[1] = 'campo');
