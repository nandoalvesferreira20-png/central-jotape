import { protectPage } from './auth.js';
import { dashboardCounts } from './repository.js';
import { message, friendlyError } from './ui.js';
async function init() {
  const context = await protectPage();
  if (!context) return;
  message('Carregando visão geral…');
  try {
    const counts = await dashboardCounts(context.client);
    for (const [key, count] of Object.entries(counts)) document.querySelector('[data-count="' + key + '"]').textContent = String(count);
    message('Painel conectado. Notícias publicadas aparecem no portal; até três destaques recentes aparecem na home.');
  } catch (error) { message(friendlyError(error), true); }
}
init();

