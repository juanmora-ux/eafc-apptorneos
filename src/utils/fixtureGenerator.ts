import { TournamentParticipant } from '../types/database';

export interface GeneratedMatch {
  home_user_id: string;
  home_club_id: string;
  away_user_id: string;
  away_club_id: string;
  round_number: number;
  is_second_leg: boolean; // Indica si es fecha de vuelta
}

export interface GeneratedRound {
  round_number: number;
  name: string;
  matches: GeneratedMatch[];
}

/**
 * Algoritmo Round-Robin de Berger (Polygon Method) para generación de torneos
 * Todos contra Todos con formato de IDA y VUELTA.
 * 
 * Matemáticas del Algoritmo para la Defensa Oral:
 * 1. Si el número de participantes (N) es impar, se añade un comodín nulo (BYE).
 * 2. Número de fechas de ida = N - 1.
 * 3. En cada fecha, se fija el elemento [0] y se rotan cíclicamente los N-1 restantes.
 * 4. Se emparejan los extremos: [i] vs [N - 1 - i].
 * 5. Para la vuelta (Leg 2), se generan N - 1 fechas adicionales idénticas pero
 *    invirtiendo estrictamente la localía: el que fue local ahora es visitante.
 * 6. Total de fechas = 2 * (N - 1).
 */
export function generateRoundRobinFixture(
  participants: TournamentParticipant[]
): GeneratedRound[] {
  if (participants.length < 2) {
    throw new Error('Se requieren al menos 2 participantes para generar el calendario.');
  }

  // Clonar la lista de participantes
  const list = [...participants];

  // Si N es impar, se añade un participante virtual para representar descanso
  const isOdd = list.length % 2 !== 0;
  if (isOdd) {
    list.push({
      id: 'DUMMY_BYE',
      tournament_id: participants[0].tournament_id,
      user_id: 'DUMMY_BYE',
      club_id: 'DUMMY_BYE',
      joined_at: new Date().toISOString(),
    });
  }

  const numTeams = list.length;
  const numRoundsFirstLeg = numTeams - 1;
  const matchesPerRound = numTeams / 2;

  const firstLegRounds: GeneratedRound[] = [];

  // --- FASE 1: GENERACIÓN DE PARTIDOS DE IDA ---
  for (let roundIndex = 0; roundIndex < numRoundsFirstLeg; roundIndex++) {
    const roundNumber = roundIndex + 1;
    const currentMatches: GeneratedMatch[] = [];

    for (let matchIndex = 0; matchIndex < matchesPerRound; matchIndex++) {
      const homeTeam = list[matchIndex];
      const awayTeam = list[numTeams - 1 - matchIndex];

      // Omitir emparejamientos con el comodín de descanso
      if (homeTeam.id === 'DUMMY_BYE' || awayTeam.id === 'DUMMY_BYE') {
        continue;
      }

      // Alternancia de localía para evitar rachas injustas de local/visitante
      const shouldFlip = (roundIndex + matchIndex) % 2 === 1;
      const actualHome = shouldFlip ? awayTeam : homeTeam;
      const actualAway = shouldFlip ? homeTeam : awayTeam;

      currentMatches.push({
        home_user_id: actualHome.user_id,
        home_club_id: actualHome.club_id,
        away_user_id: actualAway.user_id,
        away_club_id: actualAway.club_id,
        round_number: roundNumber,
        is_second_leg: false,
      });
    }

    firstLegRounds.push({
      round_number: roundNumber,
      name: `Jornada ${roundNumber} (Ida)`,
      matches: currentMatches,
    });

    // Rotación de Berger: se deja fijo el primer elemento [0] y se rota el resto
    const fixedTeam = list[0];
    const rotatingTeams = list.slice(1);
    const lastTeam = rotatingTeams.pop()!;
    rotatingTeams.unshift(lastTeam);
    list.splice(0, list.length, fixedTeam, ...rotatingTeams);
  }

  // --- FASE 2: GENERACIÓN DE PARTIDOS DE VUELTA (INVERSIÓN DE LOCALÍA) ---
  const secondLegRounds: GeneratedRound[] = [];

  for (let i = 0; i < firstLegRounds.length; i++) {
    const leg1Round = firstLegRounds[i];
    const roundNumber = numRoundsFirstLeg + i + 1;

    const reversedMatches: GeneratedMatch[] = leg1Round.matches.map((m) => ({
      home_user_id: m.away_user_id,
      home_club_id: m.away_club_id,
      away_user_id: m.home_user_id,
      away_club_id: m.home_club_id,
      round_number: roundNumber,
      is_second_leg: true,
    }));

    secondLegRounds.push({
      round_number: roundNumber,
      name: `Jornada ${roundNumber} (Vuelta)`,
      matches: reversedMatches,
    });
  }

  // Retornar todas las jornadas secuenciales (Ida + Vuelta)
  return [...firstLegRounds, ...secondLegRounds];
}
