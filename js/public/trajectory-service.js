// Somente consultas públicas. RLS continua sendo a barreira de autorização.
export async function loadPublicTrajectory(client, year = 2026) {
  const { data: trajectory, error } = await client.from('trajectory').select('*')
    .eq('year', year).eq('publication_status', 'published').maybeSingle();
  if (error) throw error;
  if (!trajectory) return null;
  const matches = [];
  // Paginar evita truncar a trajetória no limite padrão da API.
  for (let offset = 0; ; offset += 100) {
    const { data, error: matchError } = await client.from('trajectory_matches').select('*')
      .eq('trajectory_id', trajectory.id).order('position', { ascending: true })
      .order('id', { ascending: true }).range(offset, offset + 99);
    if (matchError) throw matchError;
    matches.push(...(data || []));
    if (!data || data.length < 100) break;
  }
  return { trajectory, matches };
}

// Conquista informada pelo responsável: só aparece quando os quatro resultados
// correspondentes também estão cadastrados e publicados pelo CMS.
export function hasNorteTitle(matches) {
  const results = [['CZP', 1], ['Rafael Z.O', 0], ['Youngui', 1], ['Bask', 1]];
  return results.every(([opponent, score]) => matches.some(match =>
    match.competition?.trim().toLocaleLowerCase('pt-BR') === 'seletiva da norte' &&
    match.opponent?.trim().toLocaleLowerCase('pt-BR') === opponent.toLocaleLowerCase('pt-BR') &&
    match.result === 'win' && match.jotape_score === 2 && match.opponent_score === score));
}
