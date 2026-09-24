import { getPublicSupabase } from '../supabase-client.js';
import { safeCover } from '../news.js';
import { loadPublicTrajectory, hasNorteTitle } from './trajectory-service.js';

function node(tag, text, className) {
  const item = document.createElement(tag);
  if (text !== undefined) item.textContent = text;
  if (className) item.className = className;
  return item;
}
function media(url, alt, className) {
  const src = safeCover(url);
  if (!src) return null;
  const image = node('img', undefined, className);
  image.src = src; image.alt = alt; image.decoding = 'async';
  image.addEventListener('error', () => image.remove(), { once: true });
  return image;
}
function step(stage, status, marker, index, state = 'future') {
  const item = node('li', undefined, 'route-step route-' + state);
  const meta = node('div', undefined, 'route-top');
  meta.append(node('span', String(index + 1).padStart(2, '0'), 'route-number'), node('span', marker, 'route-marker'));
  item.append(meta, node('h3', stage), node('p', status));
  if (state === 'current') {
    item.setAttribute('aria-current', 'step');
    item.append(node('span', 'Você está aqui', 'route-current-label'));
  }
  return item;
}
function nextGoal(trajectory) {
  // Compatibilidade visual com o cadastro antigo: não modifica dados no banco.
  const current = trajectory.current_stage?.trim().toLocaleLowerCase('pt-BR');
  const next = trajectory.next_stage?.trim();
  return current === 'regional' && (!next || next.toLocaleLowerCase('pt-BR') === 'nacional') ? 'Estadual' : next;
}
function campaignPhoto(trajectory) {
  const figure = node('figure', undefined, 'journey-photo');
  const image = node('img', undefined, 'journey-hero-image');
  const local = new URL('../../assets/img/jotape-hero.jpg', import.meta.url).href;
  const configured = safeCover(trajectory.hero_image_url);
  function useLocal() {
    image.src = local;
    figure.classList.add('is-local-photo');
    image.alt = 'Jotapê em fotografia editorial entre peças de merch';
  }
  image.alt = 'Jotapê — trajetória ' + trajectory.year;
  image.decoding = 'async'; image.loading = 'eager'; image.fetchPriority = 'high';
  if (configured) image.src = configured; else useLocal();
  image.addEventListener('error', () => {
    if (!figure.classList.contains('is-local-photo')) useLocal();
    else { image.remove(); figure.classList.add('photo-unavailable'); }
  });
  figure.append(image, node('figcaption', 'JOTAPÊ / ' + trajectory.year));
  return figure;
}
// Conteúdo aprovado pela Central. Fonte isolada para futura integração editorial.
const approvedRhymes = [
  'Eu trampei nas praças e foi tudo com rima, mas sem vender meu corpo, sem vender minha mente, tenho ideias de graça, todas literalmente.',
  'Mano eu sei que a cada 10, 11 vai ser na maldade e sei que a cada 16, eu vou ser o melhor da chave',
  'Você mata um leão por dia, eu sobrevivo na savana.'
];
function renderRhymes() {
  const section = node('section', undefined, 'journey-section journey-rhymes');
  section.setAttribute('aria-labelledby', 'rhymes-title');
  section.append(node('p', 'JOTAPÊ / NA RIMA', 'journey-label'));
  const title = node('h2', 'Rimas que marcaram a caminhada');
  title.id = 'rhymes-title';
  section.append(title);
  const composition = node('div', undefined, 'rhymes-composition');
  approvedRhymes.forEach((text, index) => {
    const figure = node('figure', undefined, 'rhyme' + (index === 0 ? ' rhyme-lead' : ''));
    const number = node('span', String(index + 1).padStart(2, '0'), 'rhyme-index');
    number.setAttribute('aria-hidden', 'true');
    const quote = node('blockquote');
    quote.append(node('p', '“' + text + '”'));
    const caption = node('figcaption');
    caption.append(node('span', 'JOTAPÊ'), node('span', 'TRAJETÓRIA 2026'));
    figure.append(number, quote, caption);
    composition.append(figure);
  });
  section.append(composition);
  return section;
}

function render({ trajectory, matches }) {
  const root = node('div');
  const champion = hasNorteTitle(matches);
  const goal = nextGoal(trajectory);
  const hero = node('section', undefined, 'journey-hero');
  const copy = node('div', undefined, 'journey-hero-copy');
  copy.append(node('p', 'JOTAPÊ / TRAJETÓRIA ' + trajectory.year, 'journey-label'));
  const title = node('h1', trajectory.title);
  if (trajectory.title?.trim().toLocaleLowerCase('pt-BR') === 'rumo ao nacional') {
    title.replaceChildren(node('span', 'RUMO AO '), node('span', 'NACIONAL'));
  }
  copy.append(title);
  if (trajectory.subtitle) copy.append(node('p', trajectory.subtitle, 'journey-subtitle'));
  const compact = node('div', undefined, 'hero-status');
  if (champion) compact.append(node('p', '✓ Campeão da Seletiva da Norte'));
  if (trajectory.current_stage) compact.append(node('p', (trajectory.current_status || 'Etapa atual') + ' · ' + trajectory.current_stage));
  copy.append(compact);
  const cta = node('a', 'Acompanhar a caminhada ↓', 'journey-link'); cta.href = '#caminho'; copy.append(cta);
  hero.append(copy, campaignPhoto(trajectory)); root.append(hero);

  const status = node('section', undefined, 'journey-section journey-progress');
  status.id = 'caminho';
  status.append(node('p', '01 / A CAMINHADA', 'journey-label'), node('h2', 'Caminho para o Nacional'));
  const route = node('ol', undefined, 'journey-route');
  route.setAttribute('aria-label', 'Situação da trajetória');
  const stages = ['Seletiva da Norte', 'Regional', 'Estadual', 'Nacional'];
  const currentIndex = stages.findIndex(stage => stage.toLocaleLowerCase('pt-BR') === trajectory.current_stage?.trim().toLocaleLowerCase('pt-BR'));
  stages.forEach((stage, index) => {
    if (index === 0 && champion) route.append(step(stage, 'Campeão', '✓', index, 'complete'));
    else if (index === currentIndex) route.append(step(stage, trajectory.current_status || 'Etapa atual', '●', index, 'current'));
    else route.append(step(stage, index === 3 ? 'Objetivo final' : stage === goal ? 'Próxima meta' : index < currentIndex ? 'Etapa anterior' : 'Etapa futura', '○', index));
  });
  status.append(route, node('p', 'Etapas futuras são metas. Classificações serão atualizadas quando confirmadas.', 'route-note'));
  root.append(status);

  const battles = node('section', undefined, 'journey-section');
  battles.append(node('p', '02 / BATALHA POR BATALHA', 'journey-label'),
    node('h2', champion ? 'O caminho até o Regional' : 'O caminho até aqui'));
  if (!matches.length) battles.append(node('p', 'Nenhuma batalha cadastrada.', 'journey-empty'));
  const list = node('ol', undefined, 'journey-matches');
  matches.forEach((match, index) => {
    const item = node('li', undefined, 'journey-match');
    const meta = node('div', undefined, 'match-meta');
    meta.append(node('span', String(index + 1).padStart(2, '0'), 'match-number'), node('span', match.competition));
    if (match.phase) meta.append(node('span', match.phase));
    if (match.battle_date) {
      // Campo date sem timezone: não converter para meia-noite UTC.
      const date = node('time', match.battle_date.split('-').reverse().join('/'));
      date.dateTime = match.battle_date; meta.append(date);
    }
    const score = node('div', undefined, 'match-score');
    score.append(node('span', 'Jotapê', 'match-name'),
      node('strong', (match.jotape_score ?? '—') + ' × ' + (match.opponent_score ?? '—'), 'score-value'),
      node('span', match.opponent || 'Adversário não informado', 'match-name'));
    item.append(meta, score, node('p', ({ win: 'Vitória', loss: 'Derrota', draw: 'Empate', pending: 'Resultado pendente' })[match.result] || 'Resultado não informado', 'match-result'));
    const picture = media(match.image_url, 'Registro de Jotapê contra ' + (match.opponent || 'adversário não informado'), 'match-image');
    if (picture) { picture.loading = 'lazy'; item.append(picture); }
    const video = safeCover(match.video_url);
    if (video) {
      const link = node('a', 'Assistir à batalha ↗', 'journey-link');
      link.href = video; link.target = '_blank'; link.rel = 'noopener noreferrer'; item.append(link);
    }
    list.append(item);
  });
  battles.append(list); root.append(battles);
  if (champion) {
    const result = node('section', undefined, 'journey-result');
    result.append(node('p', 'CAPÍTULO CONCLUÍDO / SELETIVA DA NORTE', 'journey-label'), node('h2', 'CAMPEÃO'), node('p', 'DA SELETIVA DA NORTE', 'result-competition'), node('p', 'Classificado para o Regional.'));
    root.append(result);
  }
  const next = node('section', undefined, 'journey-section journey-next');
  next.append(node('p', '03 / O PRÓXIMO CAPÍTULO', 'journey-label'),
    node('h2', trajectory.current_stage || 'Próximo capítulo em construção.'));
  if (trajectory.current_status) next.append(node('p', trajectory.current_status, 'journey-subtitle'));
  next.append(node('p', 'A caminhada continua.'));
  if (goal) next.append(node('p', 'Próxima meta: ' + goal + '.', 'next-goal'));
  const future = node('p', undefined, 'next-path');
  future.append(node('span', trajectory.current_stage || 'Etapa atual'), node('span', '→', 'path-arrow'));
  if (goal && goal.toLocaleLowerCase('pt-BR') !== 'nacional') future.append(node('span', goal), node('span', '→', 'path-arrow'));
  future.append(node('span', 'Nacional · objetivo final'));
  next.append(future);
  root.append(next, renderRhymes());
  return root;
}
async function initTrajectory() {
  const container = document.querySelector('[data-trajectory]');
  const status = document.querySelector('[data-trajectory-status]');
  const retry = document.querySelector('[data-trajectory-retry]');
  let busy = false;
  async function load() {
    if (busy) return;
    busy = true; retry.hidden = true; container.replaceChildren();
    container.setAttribute('aria-busy', 'true');
    status.setAttribute('role', 'status'); status.textContent = 'Carregando trajetória…';
    try {
      const data = await loadPublicTrajectory(await getPublicSupabase(), 2026);
      status.textContent = data ? '' : 'Trajetória ainda não publicada.';
      if (data) container.append(render(data));
    } catch {
      status.textContent = 'Erro ao carregar trajetória. Tente novamente.';
      status.setAttribute('role', 'alert'); retry.hidden = false;
    } finally { busy = false; container.removeAttribute('aria-busy'); }
  }
  retry.addEventListener('click', load);
  window.addEventListener('pageshow', event => { if (event.persisted) load(); });
  await load();
}
initTrajectory();
