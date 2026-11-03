import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { agendaToday, eventDateParts, eventTime, upcomingEvents } from '../js/events.js';

test('agenda considera o dia de São Paulo e preserva datas civis, inclusive na virada UTC', () => {
  assert.equal(agendaToday(new Date('2026-11-04T02:59:59Z')), '2026-11-03');
  assert.equal(agendaToday(new Date('2026-11-04T03:00:00Z')), '2026-11-04');
  assert.deepEqual(eventDateParts('2026-11-28'), { day: '28', month: 'NOV', full: '28/11/2026' });
  assert.equal(eventDateParts('2028-02-29').full, '29/02/2028');
  assert.throws(() => eventDateParts('2026-02-30'));
  assert.equal(eventTime('00:15:00'), '00:15');
  assert.equal(eventTime(null), '');
  assert.equal(eventTime('25:00'), '');
});

test('consulta filtra publicação e dia, ordena e pagina sem truncar os próximos eventos', async () => {
  const requests = [];
  const client = { from(table) {
    const request = { table, filters: [], orders: [] };
    requests.push(request);
    return {
      select(fields) { request.fields = fields; return this; },
      eq(...args) { request.filters.push(['eq', ...args]); return this; },
      gte(...args) { request.filters.push(['gte', ...args]); return this; },
      order(...args) { request.orders.push(args); return this; },
      async range(a, b) { request.range = [a, b]; return { data: a === 0 ? Array.from({ length: 100 }, (_, id) => ({ id })) : [{ id: 100 }] }; },
    };
  } };
  assert.equal((await upcomingEvents(client, new Date('2026-11-04T01:00:00Z'))).length, 101);
  assert.equal(requests.length, 2);
  assert.deepEqual(requests[0].filters, [['eq', 'status', 'published'], ['gte', 'event_date', '2026-11-03']]);
  assert.deepEqual(requests[0].orders.map(([field]) => field), ['event_date', 'event_time', 'id']);
  assert.deepEqual(requests[1].range, [100, 199]);
  await assert.rejects(upcomingEvents({ from() { return {
    select() { return this; }, eq() { return this; }, gte() { return this; }, order() { return this; },
    async range() { return { error: new Error('offline') }; },
  }; } }), /offline/);
});

test('a alteração da home fica restrita à Agenda e aos dois novos imports', async () => {
  const current = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const before = execFileSync('git', ['show', 'HEAD:index.html'], { encoding: 'utf8' });
  const strip = html => html.replace(/\r\n/g, '\n')
    .replace(/^.*(?:css\/home-agenda.css|js\/public\/home-agenda.js).*\n/gm, '')
    .replace(/<section class="agenda section"[\s\S]*?<\/section>/, 'AGENDA');
  assert.equal(strip(current), strip(before));
});
