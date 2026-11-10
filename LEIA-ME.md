# Campanha Inteligente — cópia do código-fonte

Cópia preparada em 30/10/2026. O sistema original não foi alterado.

## Incluído
- Telas, regras e funções do sistema; configurações de dependências e aplicativo móvel.
- Histórico da estrutura do banco, sem comandos que inserem ou alteram cadastros.
- Imagens fixas do candidato e modelo de santinho, disponíveis localmente em public/.
- Tipos da estrutura do banco, sem conteúdo das tabelas.

## Não incluído
- Cadastros, votos importados do TSE, bairros, cidades carregadas no banco, usuários, senhas, sessões, chaves privadas ou fotos enviadas pelos usuários.
- Histórico Git, conversas, dependências instaladas ou arquivos compilados.
- Arquivos .env reais. A senha temporária fixa foi retirada somente desta cópia.

## Instalação por um profissional
1. Instalar Node.js compatível e executar npm ci.
2. Copiar .env.example para .env e configurar a URL e a chave pública de UM NOVO ambiente.
3. Criar o novo banco e revisar/aplicar as migrações em ordem. As migrações são histórico de estrutura, não um dump validado de restauração; requerem os serviços e esquemas gerenciados correspondentes. drizzle/migrations contém alterações adicionais, também necessárias.
4. Configurar autenticação, criar o primeiro administrador e adaptar os identificadores fixos de Super Admin à nova conta. Os identificadores presentes no código são referências de regras, não cópias de contas.
5. Implantar as funções e configurar seus segredos, OAuth, URLs, permissões e agendamentos. O arquivo supabase/config.toml e algumas funções conservam referências ao ambiente original: adaptar ao novo ambiente antes de executar. Não conectar a cópia ao ambiente original.
6. Recriar o espaço de arquivos app-assets; não há fotos de cadastros neste pacote. Reimportar separadamente as cidades e os dados públicos eleitorais se desejado.
7. Configurar TEMPORARY_RESET_PASSWORD com uma NOVA senha temporária antes de usar a redefinição administrativa. A interface não revela nenhum valor antigo.
8. Executar npm run dev para desenvolvimento e npm run build para gerar a aplicação. Configurar hospedagem, domínio e, se necessário, as lojas móveis.

Esta cópia serve para reconstrução sem cadastros. Não é um backup completo nem uma instalação pronta em um clique. Integrações e serviços exigem nova configuração. Não foi feita uma restauração completa em outro ambiente.

## Integridade
MANIFESTO-SHA256.txt lista os arquivos e suas assinaturas. REVISAO-EXPORTACAO.txt registra quais migrações tiveram comandos de dados retirados, sem expor os dados.
