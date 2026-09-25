# Recuperação de senha administrativa

## Fluxo
Login → Esqueci minha senha → e-mail → /admin/reset-password.html → nova senha → encerramento local da sessão → login.

O envio usa resetPasswordForEmail(email, { redirectTo }), onde redirectTo é window.location.origin + '/admin/reset-password.html'. Nenhum domínio local é fixado em código. A resposta não informa se um endereço tem conta.

A nova página reutiliza o client e CSS existentes. Mantém o fluxo implícito padrão do SDK 2.116.0. A detecção de tokens fica habilitada somente nessa página e somente para um fragmento type=recovery com access_token e refresh_token, sem erro. Demais páginas e o client público anônimo preservam detectSessionInUrl=false.

Um único listener observa PASSWORD_RECOVERY e encerramento/troca de sessão; o callback não chama métodos Auth. getSession e getUser validam a sessão fora do listener. Se o evento ocorreu antes da inscrição, a correspondência exata entre o token recebido e a sessão processada pelo SDK evita depender do timing do evento. Uma sessão comum sem link de recuperação não libera o formulário. A página não consulta profiles/roles nem RPC de autorização.

Tokens são removidos da URL depois da inicialização. Não se cria armazenamento adicional de tokens ou senhas. Recarregar a página limpa exige um novo link; não existe marcador persistente que transforme sessões comuns em sessões de recuperação.

As senhas são obrigatórias, iguais e têm mínimo de 8 caracteres. O Auth continua impondo as regras configuradas no projeto, inclusive regras mais fortes. Falhas são apresentadas na tela sem expor valores sensíveis. O envio bloqueia submits duplicados.

Após updateUser, a sessão local é encerrada e o login recebe ?reset=success. O login consome e remove esse parâmetro do histórico; a mensagem não reaparece em recarregamentos seguintes. Uma falha ao sair oferece nova tentativa, sem repetir a atualização da senha.

## Dashboard Supabase — ação manual necessária
Em Authentication → URL Configuration:
- Site URL: o domínio oficial de produção.
- Redirect URLs: incluir exatamente https://central-jotape.vercel.app/admin/reset-password.html.
- Para cada origem local usada, cadastrar o callback correspondente, por exemplo http://localhost:8080/admin/reset-password.html.
- Se a prévia usa 127.0.0.1 e outra porta, cadastrar também essa origem exata; localhost e 127.0.0.1 são origens diferentes.
- Para previews da Vercel, permitir os domínios de preview realmente utilizados.

Em Email Templates → Reset Password, manter o link padrão {{ .ConfirmationURL }}. Um template customizado que fixa localhost ou ignora RedirectTo precisa ser corrigido no dashboard. Não apontar diretamente ao callback sem passar pela verificação do Auth.

Nenhuma configuração remota, conta, role, policy, chave ou template foi alterado por esta implementação. Não há service_role ou chave secreta.

## Verificação manual com e-mail real
1. Publicar os arquivos e cadastrar os callbacks.
2. No login, solicitar recuperação para uma conta controlada pela equipe.
3. Conferir a caixa de entrada/spam e abrir o link mais recente.
4. Validar senha divergente; depois salvar uma senha válida.
5. Confirmar retorno ao login e entrada com a nova senha.
6. Conferir um link expirado e acesso direto sem link; ambos devem mostrar ação para solicitar novo link.

## Testes automatizados
A suíte cobre envio e redirectTo, validação, atualização única, retorno ao login, senha antiga recusada/nova aceita, sessão comum rejeitada, token expirado, usuário inválido, evento emitido antes da inscrição, erros e responsividade 375/390/430/768/1440.

Há verificação adicional com o SDK real 2.116.0 e endpoints Auth interceptados no navegador. Ela confirma o processamento do callback e updateUser sem alterar contas reais. O recebimento de e-mail real e as configurações do dashboard dependem da verificação manual acima.

Build já copia admin/ e js/; não foi necessário mudar seu script. Conferir dist/admin/reset-password.html e dist/js/admin/reset-password.js.

Referências:
- https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail
- https://supabase.com/docs/guides/auth/redirect-urls

Resultado: 66 testes aprovados (11 Node, 40 regressões existentes e 15 de recuperação); SDK real 2.116.0 validado com HTTP Auth simulado; build aprovado e arquivos conferidos em dist. Nenhum e-mail foi enviado e nenhuma senha real foi alterada.
