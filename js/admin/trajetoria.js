import { protectPage } from './auth.js';
import { saveRecord, deleteRecord } from './repository.js';
import { bindUpload } from './storage.js';
import { message, friendlyError, withBusy, setFields, element, empty } from './ui.js';
import { required, optional, httpsUrl, enumValue, integer, dateOnly } from './validation.js';

export function trajectoryPayload(data) {
  return {
    year: integer(data.get('year') ?? '2026', 'Ano', 2000, 2100), title: required(data.get('title'), 'Título'), subtitle: optional(data.get('subtitle'), 500),
    current_stage: optional(data.get('current_stage'), 240),
    current_status: optional(data.get('current_status'), 240),
    hero_image_url: httpsUrl(data.get('hero_image_url')), next_stage: optional(data.get('next_stage'), 240),
    publication_status: enumValue(data.get('publication_status'), ['draft', 'published']),
  };
}
export function matchPayload(data, trajectoryId) {
  return {
    trajectory_id: trajectoryId, competition: required(data.get('competition'), 'Competição'),
    phase: optional(data.get('phase'), 120), opponent: optional(data.get('opponent'), 120),
    jotape_score: integer(data.get('jotape_score'), 'Placar Jotapê', 0, 999, true),
    opponent_score: integer(data.get('opponent_score'), 'Placar adversário', 0, 999, true),
    result: enumValue(data.get('result'), ['pending', 'win', 'loss', 'draw']),
    battle_date: dateOnly(data.get('battle_date'), true),
    video_url: httpsUrl(data.get('video_url')), image_url: httpsUrl(data.get('image_url')),
    position: integer(data.get('position'), 'Posição', 0, 9999),
  };
}
async function init() {
  const context = await protectPage();
  if (!context) return;
  const { client } = context;
  const form = document.querySelector('#trajectory-form');
  const matchForm = document.querySelector('#match-form');
  const container = document.querySelector('[data-matches]');
  const requestedYear = new URLSearchParams(location.search).get('year') || '2026';
  let selectedYear;
  try { selectedYear = integer(requestedYear, 'Ano', 2000, 2100); }
  catch (error) { message(friendlyError(error), true); return; }
  form.elements.year.value = selectedYear;
  let trajectoryId = null;
  let matchId = null;
  let page = 0;
  const previous = document.querySelector('[data-previous]');
  const next = document.querySelector('[data-next]');
  async function loadMatches() {
    if (!trajectoryId) { empty(container, 'Salve a trajetória antes de cadastrar batalhas.'); return; }
    previous.disabled = next.disabled = true;
    const { data, error, count } = await client.from('trajectory_matches').select('*', { count: 'exact' })
      .eq('trajectory_id', trajectoryId).order('position').order('id').range(page * 20, page * 20 + 19);
    if (error) throw error;
    if (!data.length && page > 0) { page--; return loadMatches(); }
    container.replaceChildren();
    if (!data.length) empty(container, 'Nenhuma batalha cadastrada.');
    for (const row of data) {
      const article = element('article', undefined, 'record');
      const info = element('div');
      info.append(element('h3', row.competition), element('p', (row.phase || 'Fase a definir') + ' · ' + (row.opponent || 'Adversário a definir'), 'muted'));
      const actions = element('div', undefined, 'actions');
      const edit = element('button', 'Editar', 'secondary');
      edit.type = 'button';
      edit.addEventListener('click', () => { matchId = row.id; setFields(matchForm, row); matchForm.elements.competition.focus(); });
      const remove = element('button', 'Excluir', 'danger');
      remove.type = 'button';
      remove.addEventListener('click', async () => {
        if (!confirm('Excluir esta batalha definitivamente?')) return;
        remove.disabled = true;
        try {
          await deleteRecord(client, 'trajectory_matches', row.id);
          if (matchId === row.id) { matchId = null; matchForm.reset(); }
          await loadMatches();
        } catch (error) { message(friendlyError(error), true); remove.disabled = false; }
      });
      info.append(element('p', 'Jotapê ' + (row.jotape_score ?? '—') + ' × ' + (row.opponent_score ?? '—') + ' · Posição ' + row.position, 'muted'));
      actions.append(edit, remove); article.append(info, actions); container.append(article);
    }
    document.querySelector('[data-page]').textContent = count + ' batalha(s) · Página ' + (page + 1);
    previous.disabled = page === 0; next.disabled = (page + 1) * 20 >= count;
  }
  async function refreshMatches() {
    try { await loadMatches(); } catch (error) { message(friendlyError(error), true); }
  }
  previous.addEventListener('click', () => { if (page > 0) { page--; refreshMatches(); } });
  next.addEventListener('click', () => { page++; refreshMatches(); });
  document.querySelector('[data-refresh]').addEventListener('click', refreshMatches);
  message('Carregando trajetória…');
  try {
    const { data, error } = await client.from('trajectory').select('*').eq('year', selectedYear).maybeSingle();
    if (error) throw error;
    if (data) { trajectoryId = data.id; setFields(form, data); }
    form.querySelector('fieldset').disabled = false;
    matchForm.querySelector('fieldset').disabled = !trajectoryId;
    await loadMatches();
    message('');
  } catch (error) { message(friendlyError(error), true); return; }
  bindUpload(form, client, 'trajectory');
  bindUpload(matchForm, client, 'trajectory');
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    let payload;
    try { payload = trajectoryPayload(new FormData(form)); } catch (error) { message(friendlyError(error), true); return; }
    await withBusy(form, async () => {
      message('Salvando trajetória…');
      try {
        const saved = await saveRecord(client, 'trajectory', payload, trajectoryId);
        trajectoryId = saved.id;
        matchForm.querySelector('fieldset').disabled = false;
        await loadMatches();
        history.replaceState(null, '', 'trajetoria.html?year=' + saved.year);
        message(saved.publication_status === 'published' ? 'Trajetória publicada. Recarregue a página pública para ver as alterações.' : 'Trajetória salva como rascunho. Ela e suas batalhas não aparecem publicamente.');
      } catch (error) { message(friendlyError(error), true); }
    });
  });
  matchForm.querySelector('[type=reset]').addEventListener('click', () => { matchId = null; });
  matchForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (!trajectoryId || !matchForm.reportValidity()) return;
    let payload;
    try { payload = matchPayload(new FormData(matchForm), trajectoryId); } catch (error) { message(friendlyError(error), true); return; }
    await withBusy(matchForm, async () => {
      message('Salvando batalha…');
      try {
        const saved = await saveRecord(client, 'trajectory_matches', payload, matchId);
        matchId = saved.id;
        await loadMatches();
        message('Batalha salva.');
      } catch (error) { message(friendlyError(error), true); }
    });
  });
}
if (typeof document !== 'undefined') init();

