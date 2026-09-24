export function message(text, error = false, target = document.querySelector('[data-message]')) {
  if (!target) return;
  target.textContent = text;
  target.classList.toggle('is-error', error);
  target.setAttribute('role', error ? 'alert' : 'status');
}
export function friendlyError(error) {
  if (['PGRST202', 'PGRST205'].includes(error?.code)) return 'O banco editorial ainda não está disponível. Confira se as duas migrations foram executadas no Supabase.';
  if (error?.code === '23505') return 'Já existe um registro com esse slug ou ano. Use outro valor.';
  if (error?.code === '42501') return 'Sem permissão para esta operação. Verifique seu acesso administrativo.';
  if (error?.code === '23514' || error?.code === '22P02') return 'Confira os campos e os valores informados.';
  if (error?.code === 'PGRST116') return 'O registro não existe mais ou seu acesso foi alterado. Recarregue a página.';
  if (error?.name === 'ValidationError') return error.message;
  return 'Não foi possível concluir. Confira sua conexão e tente novamente. Se persistir, verifique a configuração do Supabase.';
}
export async function withBusy(form, task) {
  const controls = [...form.querySelectorAll('button, input, textarea, select')];
  const previous = controls.map(control => control.disabled);
  controls.forEach(control => { control.disabled = true; });
  form.setAttribute('aria-busy', 'true');
  try { return await task(); }
  finally {
    controls.forEach((control, index) => { control.disabled = previous[index]; });
    form.removeAttribute('aria-busy');
  }
}
export function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
export function empty(container, text = 'Nenhum registro cadastrado.') {
  container.replaceChildren(element('p', text, 'empty'));
}
export function setFields(form, data) {
  for (const [name, value] of Object.entries(data)) {
    const field = form.elements.namedItem(name);
    if (!field || field.type === 'file') continue;
    if (field.type === 'checkbox') field.checked = Boolean(value);
    else field.value = value ?? '';
  }
}

