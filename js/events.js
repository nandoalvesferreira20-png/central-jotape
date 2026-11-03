// Datas civis da agenda: nunca converter event_date para meia-noite no fuso do navegador.
export const EVENT_TIME_ZONE = 'America/Sao_Paulo';

export function agendaToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: EVENT_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const value = type => parts.find(part => part.type === type).value;
  return value('year') + '-' + value('month') + '-' + value('day');
}

export function eventDateParts(value) {
  const date = new Date(value + 'T12:00:00Z');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '') || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error('Data de evento inválida.');
  }
  return {
    day: value.slice(8, 10),
    month: new Intl.DateTimeFormat('pt-BR', { month: 'short', timeZone: 'UTC' }).format(date).replace('.', '').toUpperCase(),
    full: new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(date),
  };
}

export function eventTime(value) {
  return /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?$/.test(value || '') ? value.slice(0, 5) : '';
}

export async function upcomingEvents(client, now = new Date()) {
  const today = agendaToday(now);
  const rows = [];
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await client.from('events')
      .select('id,title,description,event_date,event_time,venue,city,ticket_url,image_url,status')
      .eq('status', 'published').gte('event_date', today)
      .order('event_date', { ascending: true }).order('event_time', { ascending: true, nullsFirst: false })
      .order('id', { ascending: true }).range(offset, offset + 99);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 100) break;
  }
  return rows;
}
