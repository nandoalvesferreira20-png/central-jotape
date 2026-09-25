import { getSupabase } from '../supabase-client.js';
import { message } from './ui.js';

async function initResetPassword() {
  const form = document.querySelector('#reset-form');
  const fieldset = form.querySelector('fieldset');
  const newLink = document.querySelector('[data-new-link]');
  // O SDK usa o fluxo implícito já padrão do projeto. Nunca persistir tokens extras.
  const incoming = new URLSearchParams(location.hash.slice(1));
  let incomingToken = incoming.get('access_token');
  const recoveryLink = incoming.get('type') === 'recovery' && !!incomingToken
    && !!incoming.get('refresh_token') && !incoming.has('error') && !incoming.has('error_code')
    && !new URLSearchParams(location.search).has('error');
  let client;
  let subscription;
  let ready = false;
  let busy = false;
  let recoveryEvent = false;
  let recoveryUserId;
  function invalid() {
    ready = false;
    form.hidden = true;
    fieldset.disabled = true;
    form.reset();
    newLink.hidden = false;
    message('Este link de redefinição é inválido ou expirou.', true);
  }
  function cleanUrl() { history.replaceState(null, '', location.pathname); }
  if (!recoveryLink) { cleanUrl(); invalid(); return; }
  try {
    client = await getSupabase();
    ({ data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
      // Callback síncrono: não chamar outros métodos Auth dentro deste listener.
      if (event === 'PASSWORD_RECOVERY' && session) recoveryEvent = true;
      if (event === 'SIGNED_OUT') { ready = false; if (!busy) invalid(); }
      if (ready && session?.user?.id !== recoveryUserId && ['SIGNED_IN', 'USER_UPDATED', 'TOKEN_REFRESHED'].includes(event)) invalid();
    }));
    const { data: { session }, error } = await client.auth.getSession();
    // Além do evento, conferir o token recebido cobre eventos emitidos antes da inscrição.
    const receivedSession = recoveryEvent || (session?.access_token === incomingToken);
    if (error || !session || !receivedSession) throw new Error('invalid recovery');
    const { data: { user }, error: userError } = await client.auth.getUser();
    if (userError || !user || user.id !== session.user.id) throw new Error('invalid recovery');
    recoveryUserId = user.id;
    ready = true;
    form.hidden = false;
    fieldset.disabled = false;
    message('Link validado. Escolha sua nova senha.');
  } catch { invalid(); }
  finally { incomingToken = null; incoming.delete('access_token'); incoming.delete('refresh_token'); cleanUrl(); }

  window.addEventListener('pagehide', () => subscription?.unsubscribe(), { once: true });
  window.addEventListener('pageshow', event => { if (event.persisted) { invalid(); location.reload(); } });
  form.querySelector('[data-toggle-password]').addEventListener('click', event => {
    const visible = form.elements.password.type === 'password';
    for (const input of [form.elements.password, form.elements.confirmation]) input.type = visible ? 'text' : 'password';
    event.currentTarget.textContent = visible ? 'Ocultar senhas' : 'Mostrar senhas';
    event.currentTarget.setAttribute('aria-pressed', String(visible));
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!ready || busy) return;
    const password = form.elements.password.value;
    const confirmation = form.elements.confirmation.value;
    if (!password || !confirmation) { message('Preencha a nova senha e a confirmação.', true); return; }
    if (password.length < 8) { message('A nova senha deve ter pelo menos 8 caracteres.', true); return; }
    if (password !== confirmation) { message('As senhas precisam ser iguais.', true); return; }
    busy = true;
    fieldset.disabled = true;
    form.setAttribute('aria-busy', 'true');
    message('Atualizando senha…');
    try {
      const { data: { user }, error: sessionError } = await client.auth.getUser();
      if (sessionError || user?.id !== recoveryUserId) { invalid(); return; }
      const { error } = await client.auth.updateUser({ password });
      if (error) {
        if (error.status === 401 || error.status === 403 || error.code === 'session_not_found') invalid();
        else message(error.code === 'same_password'
          ? 'Escolha uma senha diferente da atual.'
          : error.code === 'weak_password'
            ? 'A senha não atende às regras de segurança. Use uma senha mais forte.'
            : 'Não foi possível atualizar a senha. Confira sua conexão e tente novamente.', true);
        return;
      }
      ready = false;
      form.reset();
      form.hidden = true;
      message('Sua senha foi atualizada com sucesso.');
      // Não retornar ao painel com a sessão temporária ainda aberta.
      const { error: signOutError } = await client.auth.signOut({ scope: 'local' }).catch(() => ({ error: true }));
      if (signOutError) {
        message('Sua senha foi atualizada com sucesso. Não foi possível encerrar a sessão; tente sair novamente.', true);
        const retry = document.createElement('button');
        retry.type = 'button';
        retry.textContent = 'Encerrar sessão e voltar ao login';
        retry.addEventListener('click', async () => {
          retry.disabled = true;
          try {
            const result = await client.auth.signOut({ scope: 'local' });
            if (result.error) throw result.error;
            location.replace('login.html?reset=success');
          } catch { retry.disabled = false; }
        });
        form.after(retry);
        return;
      }
      setTimeout(() => location.replace('login.html?reset=success'), 1000);
    } catch {
      message('Não foi possível concluir. Confira sua conexão e tente novamente.', true);
    } finally {
      busy = false;
      fieldset.disabled = !ready;
      form.removeAttribute('aria-busy');
    }
  });
}
initResetPassword();
