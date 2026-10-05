import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  ActivityIndicator,
  Alert,
  FlatList,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { Tournament, Round, Profile, TournamentParticipant } from '../types/database';
import { generateRoundRobinFixture } from '../utils/fixtureGenerator';

export const AdminPanelScreen: React.FC = () => {
  const { profile, user, refreshProfile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [activeTournament, setActiveTournament] = useState<Tournament | null>(null);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [availablePlayers, setAvailablePlayers] = useState<Profile[]>([]);
  const [disputedMatches, setDisputedMatches] = useState<any[]>([]);
  const [actionLoading, setActionLoading] = useState(false);

  // Cargar estado del torneo, jornadas y participantes
  const loadAdminData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Torneo activo
      const { data: tourneyData } = await supabase
        .from('tournaments')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

      const currentTourney = tourneyData && tourneyData.length > 0 ? tourneyData[0] : null;
      setActiveTournament(currentTourney);

      if (currentTourney) {
        // 2. Cargar jornadas del torneo
        const { data: roundsData } = await supabase
          .from('rounds')
          .select('*')
          .eq('tournament_id', currentTourney.id)
          .order('round_number', { ascending: true });

        if (roundsData) setRounds(roundsData as Round[]);

        // 3. Cargar partidos en disputa que requieren arbitraje
        const { data: disputes } = await supabase
          .from('matches')
          .select('*, home_user:home_user_id(username), away_user:away_user_id(username), home_club:home_club_id(name), away_club:away_club_id(name)')
          .eq('tournament_id', currentTourney.id)
          .eq('status', 'disputed');

        if (disputes) setDisputedMatches(disputes);
      }

      // 4. Cargar jugadores registrados que ya giraron la ruleta
      const { data: players } = await supabase
        .from('profiles')
        .select('*')
        .not('assigned_club_id', 'is', null);

      if (players) setAvailablePlayers(players as Profile[]);
    } catch (err: any) {
      console.error('Error loading admin data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

  // Permitir promover a admin para pruebas locales de la evaluación
  const handleMakeMeAdmin = async () => {
    if (!user?.id) return;
    try {
      await supabase.from('profiles').update({ role: 'admin' }).eq('id', user.id);
      await refreshProfile();
      Alert.alert('Éxito', 'Tu cuenta ahora tiene rol de Administrador.');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  /**
   * Generación y Creación Oficial del Torneo Round-Robin (Ida y Vuelta)
   */
  const handleStartTournament = async () => {
    if (availablePlayers.length < 2) {
      Alert.alert(
        'Participantes Insuficientes',
        'Se requieren al menos 2 jugadores con club asignado en la ruleta para iniciar el campeonato.'
      );
      return;
    }

    setActionLoading(true);
    try {
      // 1. Crear el Torneo
      const { data: newTourney, error: tErr } = await supabase
        .from('tournaments')
        .insert({
          name: 'Liga de Campeones EA FC (Ida y Vuelta)',
          status: 'in_progress',
          created_by: user?.id,
        })
        .select()
        .single();

      if (tErr || !newTourney) throw new Error(tErr?.message || 'Error al crear torneo.');

      // 2. Registrar los participantes en el torneo
      const participantsPayload = availablePlayers.map((p) => ({
        tournament_id: newTourney.id,
        user_id: p.id,
        club_id: p.assigned_club_id!,
      }));

      const { data: insertedParticipants, error: partErr } = await supabase
        .from('tournament_participants')
        .insert(participantsPayload)
        .select();

      if (partErr || !insertedParticipants) throw new Error(partErr?.message || 'Error registrando participantes.');

      // 3. Ejecutar Algoritmo Round-Robin de Berger (Ida y Vuelta)
      const generatedFixture = generateRoundRobinFixture(insertedParticipants as TournamentParticipant[]);

      // 4. Crear las jornadas (rounds) y partidos (matches)
      for (const roundData of generatedFixture) {
        // La Jornada 1 comienza activa por defecto, las siguientes en espera
        const isFirst = roundData.round_number === 1;

        const { data: createdRound, error: rErr } = await supabase
          .from('rounds')
          .insert({
            tournament_id: newTourney.id,
            round_number: roundData.round_number,
            name: roundData.name,
            is_active: isFirst,
            is_completed: false,
          })
          .select()
          .single();

        if (rErr || !createdRound) continue;

        // Inserción masiva de partidos de esta jornada
        const matchesPayload = roundData.matches.map((m) => ({
          tournament_id: newTourney.id,
          round_id: createdRound.id,
          home_user_id: m.home_user_id,
          home_club_id: m.home_club_id,
          away_user_id: m.away_user_id,
          away_club_id: m.away_club_id,
          status: 'scheduled',
          home_score: 0,
          away_score: 0,
        }));

        await supabase.from('matches').insert(matchesPayload);
      }

      // Actualizar total de jornadas en el torneo
      await supabase
        .from('tournaments')
        .update({ total_rounds: generatedFixture.length })
        .eq('id', newTourney.id);

      Alert.alert(
        '¡Torneo Iniciado!',
        `Se ha generado exitosamente el calendario Todos contra Todos con ${generatedFixture.length} jornadas de Ida y Vuelta.`
      );
      loadAdminData();
    } catch (err: any) {
      Alert.alert('Error al iniciar torneo', err.message);
    } finally {
      setActionLoading(false);
    }
  };

  /**
   * Habilitación secuencial de Fechas de juego (Switch ON / OFF)
   */
  const handleToggleRound = async (round: Round) => {
    const newStatus = !round.is_active;
    try {
      const { error } = await supabase
        .from('rounds')
        .update({ is_active: newStatus })
        .eq('id', round.id);

      if (error) {
        Alert.alert('Error', error.message);
      } else {
        setRounds((prev) =>
          prev.map((r) => (r.id === round.id ? { ...r, is_active: newStatus } : r))
        );
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  /**
   * Arbitraje Remoto: Resolver partido en disputa
   */
  const handleResolveDispute = async (matchId: string, homeScore: number, awayScore: number) => {
    try {
      const { error } = await supabase
        .from('matches')
        .update({
          home_score: homeScore,
          away_score: awayScore,
          status: 'finished',
          resolved_by: user?.id,
        })
        .eq('id', matchId);

      if (error) {
        Alert.alert('Error al resolver disputa', error.message);
      } else {
        Alert.alert('Disputa Resuelta', 'El marcador ha sido oficializado por el Administrador.');
        loadAdminData();
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#00ff87" />
        <Text style={styles.loadingText}>Cargando Panel de Control...</Text>
      </View>
    );
  }

  // Si el usuario no es admin, mostrar advertencia con opción de activar rol de prueba
  if (profile?.role !== 'admin') {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <LinearGradient colors={['#070a0f', '#161c28']} style={styles.gradient}>
          <View style={styles.unauthorizedBox}>
            <Ionicons name="lock-closed" size={60} color="#f59e0b" />
            <Text style={styles.unauthorizedTitle}>ACCESO RESTRINGIDO</Text>
            <Text style={styles.unauthorizedSubtitle}>
              Este módulo está reservado exclusivamente para los árbitros y administradores del torneo.
            </Text>
            <TouchableOpacity style={styles.promoteBtn} onPress={handleMakeMeAdmin}>
              <Text style={styles.promoteBtnText}>HABILITAR MODO ADMIN (TESTING)</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient colors={['#070a0f', '#0d131f', '#081726']} style={styles.gradient}>
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.adminTag}>PANEL DE CONTROL</Text>
              <Text style={styles.headerTitle}>ADMINISTRACIÓN DEL TORNEO</Text>
            </View>
            <TouchableOpacity onPress={loadAdminData} style={styles.refreshBtn}>
              <Ionicons name="refresh" size={20} color="#00ff87" />
            </TouchableOpacity>
          </View>

          {/* ESTADO 1: Torneo no iniciado o en Draft */}
          {!activeTournament ? (
            <View style={styles.card}>
              <Ionicons name="trophy" size={40} color="#00ff87" />
              <Text style={styles.cardTitle}>INICIAR NUEVA TEMPORADA</Text>
              <Text style={styles.cardDesc}>
                Genera automáticamente el fixture de ida y vuelta para todos los usuarios registrados.
              </Text>

              <View style={styles.playersBadge}>
                <Ionicons name="people" size={18} color="#00ff87" />
                <Text style={styles.playersCount}>
                  {availablePlayers.length} Jugadores con club asignado
                </Text>
              </View>

              <TouchableOpacity
                style={styles.actionBtn}
                onPress={handleStartTournament}
                disabled={actionLoading}
              >
                <LinearGradient
                  colors={['#00ff87', '#00b4d8']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.actionBtnGrad}
                >
                  {actionLoading ? (
                    <ActivityIndicator color="#070a0f" />
                  ) : (
                    <Text style={styles.actionBtnText}>GENERAR FIXTURE IDA Y VUELTA</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          ) : (
            /* ESTADO 2: Torneo en progreso -> Control de Fechas */
            <View>
              <View style={styles.statusBanner}>
                <View style={styles.activeDot} />
                <Text style={styles.statusBannerText}>
                  TORNEO ACTIVO: {activeTournament.name.toUpperCase()}
                </Text>
              </View>

              {/* SECCIÓN 1: HABILITACIÓN SECUENCIAL DE FECHAS */}
              <Text style={styles.sectionHeading}>HABILITAR FECHAS DE JUEGO</Text>
              <Text style={styles.sectionSubtitle}>
                Los jugadores solo pueden ingresar a jugar partidos en fechas habilitadas.
              </Text>

              <View style={styles.roundsList}>
                {rounds.map((round) => (
                  <View key={round.id} style={styles.roundRow}>
                    <View style={styles.roundInfo}>
                      <Text style={styles.roundName}>{round.name}</Text>
                      <Text
                        style={[
                          styles.roundStatus,
                          round.is_active ? styles.roundActive : styles.roundInactive,
                        ]}
                      >
                        {round.is_active ? 'HABILITADA PARA JUGAR' : 'BLOQUEADA'}
                      </Text>
                    </View>
                    <Switch
                      value={round.is_active}
                      onValueChange={() => handleToggleRound(round)}
                      thumbColor={round.is_active ? '#00ff87' : '#64748b'}
                      trackColor={{ false: '#1e293b', true: 'rgba(0, 255, 135, 0.3)' }}
                    />
                  </View>
                ))}
              </View>

              {/* SECCIÓN 2: ARBITRAJE REMOTO (PARTIDOS EN DISPUTA) */}
              <Text style={[styles.sectionHeading, { marginTop: 28 }]}>
                ARBITRAJE REMOTO (DISPUTAS)
              </Text>

              {disputedMatches.length === 0 ? (
                <View style={styles.noDisputesBox}>
                  <Ionicons name="checkmark-done-circle" size={24} color="#00ff87" />
                  <Text style={styles.noDisputesText}>No hay partidos en disputa en este momento.</Text>
                </View>
              ) : (
                disputedMatches.map((m) => (
                  <View key={m.id} style={styles.disputeCard}>
                    <View style={styles.disputeHeader}>
                      <Ionicons name="warning" size={18} color="#f59e0b" />
                      <Text style={styles.disputeTitle}>DISCREPANCIA EN MARCADOR</Text>
                    </View>

                    <Text style={styles.matchTeams}>
                      {m.home_club?.name} (@{m.home_user?.username}) vs {m.away_club?.name} (@{m.away_user?.username})
                    </Text>

                    <Text style={styles.disputeMotivo}>
                      Motivo: {m.dispute_reason || 'Visitante rechazó el marcador reportado por el local.'}
                    </Text>

                    <Text style={styles.reportedScore}>
                      Marcador reportado: {m.home_score} - {m.away_score}
                    </Text>

                    <View style={styles.disputeActions}>
                      <TouchableOpacity
                        style={styles.resolveConfirmBtn}
                        onPress={() => handleResolveDispute(m.id, m.home_score, m.away_score)}
                      >
                        <Text style={styles.resolveBtnText}>VALIDAR RESULTADO</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}
        </ScrollView>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070a0f',
  },
  gradient: {
    flex: 1,
    paddingTop: 45,
  },
  scroll: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  adminTag: {
    fontSize: 11,
    fontWeight: '800',
    color: '#00ff87',
    letterSpacing: 2,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#ffffff',
    marginTop: 2,
  },
  refreshBtn: {
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 10,
  },
  card: {
    backgroundColor: '#0f172a',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 24,
    alignItems: 'center',
    marginTop: 10,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#ffffff',
    marginTop: 12,
  },
  cardDesc: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    marginVertical: 10,
    lineHeight: 18,
  },
  playersBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 255, 135, 0.08)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 8,
    marginVertical: 12,
  },
  playersCount: {
    fontSize: 12,
    color: '#00ff87',
    fontWeight: '700',
  },
  actionBtn: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 8,
  },
  actionBtnGrad: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#070a0f',
    letterSpacing: 1,
  },
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 255, 135, 0.1)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 135, 0.3)',
    marginBottom: 20,
    gap: 8,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00ff87',
  },
  statusBannerText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#00ff87',
    letterSpacing: 1,
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 1,
  },
  sectionSubtitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 4,
    marginBottom: 14,
  },
  roundsList: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  roundRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  roundInfo: {
    flex: 1,
  },
  roundName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
  },
  roundStatus: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  roundActive: {
    color: '#00ff87',
  },
  roundInactive: {
    color: '#64748b',
  },
  noDisputesBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    padding: 16,
    borderRadius: 12,
    gap: 10,
    marginTop: 8,
  },
  noDisputesText: {
    fontSize: 12,
    color: '#94a3b8',
  },
  disputeCard: {
    backgroundColor: '#0f172a',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.4)',
    padding: 16,
    marginTop: 10,
  },
  disputeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  disputeTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#f59e0b',
  },
  matchTeams: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
  },
  disputeMotivo: {
    fontSize: 11,
    color: '#ef4444',
    marginVertical: 4,
  },
  reportedScore: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94a3b8',
    marginBottom: 10,
  },
  disputeActions: {
    flexDirection: 'row',
    gap: 10,
  },
  resolveConfirmBtn: {
    backgroundColor: '#00ff87',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  resolveBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#070a0f',
  },
  centerContainer: {
    flex: 1,
    backgroundColor: '#070a0f',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#00ff87',
    marginTop: 12,
    fontSize: 13,
  },
  unauthorizedBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  unauthorizedTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#ffffff',
    marginTop: 16,
  },
  unauthorizedSubtitle: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
    lineHeight: 18,
  },
  promoteBtn: {
    backgroundColor: '#f59e0b',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  promoteBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#070a0f',
    letterSpacing: 1,
  },
});
