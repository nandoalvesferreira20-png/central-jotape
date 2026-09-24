import { uuid } from './validation.js';
const tables = new Set(['news', 'events', 'trajectory', 'trajectory_matches']);
function table(client, name) {
  if (!tables.has(name)) throw new Error('Entidade não permitida.');
  return client.from(name);
}
export async function list(client, name, { page = 0, pageSize = 20, order = 'created_at' } = {}) {
  const from = Math.max(0, page) * pageSize;
  const { data, error, count } = await table(client, name).select('*', { count: 'exact' })
    .order(order, { ascending: false }).order('id', { ascending: false }).range(from, from + pageSize - 1);
  if (error) throw error;
  return { rows: data || [], count: count || 0 };
}
export async function getRecord(client, name, id) {
  const { data, error } = await table(client, name).select('*').eq('id', uuid(id)).single();
  if (error) throw error;
  return data;
}
export async function saveRecord(client, name, payload, id = null) {
  const query = id ? table(client, name).update(payload).eq('id', uuid(id)) : table(client, name).insert(payload);
  const { data, error } = await query.select().single();
  if (error) throw error;
  return data;
}
export async function deleteRecord(client, name, id) {
  const { data, error } = await table(client, name).delete().eq('id', uuid(id)).select('id').single();
  if (error) throw error;
  return data;
}
export async function dashboardCounts(client) {
  const entries = await Promise.all(['news', 'events', 'trajectory_matches'].map(async name => {
    const { count, error } = await table(client, name).select('id', { count: 'exact', head: true });
    if (error) throw error;
    return [name, count];
  }));
  return Object.fromEntries(entries);
}

