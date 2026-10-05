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
  TextInput,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { Tournament, Round, Profile, TournamentParticipant, Club, Player } from '../types/database';
import { generateRoundRobinFixture } from '../utils/fixtureGenerator';

type AdminTab = 'fixture' | 'results' | 'players';

export const AdminPanelScreen: React.FC = () => {
  const { profile, user, refreshProfile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<AdminTab>('fixture');
  const [activeTournament, setActiveTournament] = useState<Tournament | null>(null);
  const [rounds, setRounds] = useState<Round[]>([]);
  const [availablePlayers, setAvailablePlayers] = useState<Profile[]>([]);
  const [actionLoading, setActionLoading] = useState(false);

  // --- Estado para Edición de Resultados ---
  const [matches, setMatches] = useState<any[]>([]);
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
  const [homeScoreInput, setHomeScoreInput] = useState('');
  const [awayScoreInput, setAwayScoreInput] = useState('');

  // --- Estado para Gestión/Eliminación de Jugadores ---
  const [clubs, setClubs] = useState<Club[]>([]);
  const [selectedClubId, setSelectedClubId] = useState<string | null>(null);
  const [clubPlayers, setClubPlayers] = useState<Player[]>([]);

  // Cargar datos administrativos
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
        // 2. Cargar jornadas
        const { data: roundsData } = await supabase
          .from('rounds')
          .select('*')
          .eq('tournament_id', currentTourney.id)
          .order('round_number', { ascending: true });

        if (roundsData) setRounds(roundsData as Round[]);

        // 3. Cargar partidos para edición
        const { data: matchesData } = await supabase
          .from('matches')
          .select('*, home_user:home_user_id(username), away_user:away_user_id(username), home_club:home_club_id(short_name), away_club:away_club_id(short_name), rounds(name)')
          .eq('tournament_id', currentTourney.id)
          .order('created_at', { ascending: false });

        if (matchesData) setMatches(matchesData);
      }

      // 4. Cargar perfiles registrados
      const { data: players } = await supabase
        .from('profiles')
        .select('*')
        .not('assigned_club_id', 'is', null);

      if (players) setAvailablePlayers(players as Profile[]);

      // 5. Cargar lista de clubes
      const { data: clubsData } = await supabase.from('clubs').select('*').order('name');
      if (clubsData) {
        setClubs(clubsData as Club[]);
        if (clubsData.length > 0 && !selectedClubId) {
          setSelectedClubId(clubsData[0].id);
          fetchPlayersByClub(clubsData[0].id);
        }
      }
    } catch (err: any) {
      console.error('Error loading admin data:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedClubId]);

  useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

  const fetchPlayersByClub = async (clubId: string) => {
    setSelectedClubId(clubId);
    const { data } = await supabase
      .from('players')
      .select('*')
      .eq('club_id', clubId)
      .order('rating', { ascending: false });
    setClubPlayers((data as Player[]) || []);
  };

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
   * 1. Generación de Torneo y Fixture
   */
  const handleStartTournament = async () => {
    if (availablePlayers.length < 2) {
      Alert.alert('Inmposible Sorteo', 'Se requieren al menos 2 jugadores con club asignado.');
      return;
    }

    setActionLoading(true);
    try {
      const { data: newTourney, error: tErr } = await supabase
        .from('tournaments')
        .insert({
          name: 'Liga de Campeones EA FC',
          status: 'in_progress',
          created_by: user?.id,
        })
        .select()
        .single();

      if (tErr || !newTourney) throw new Error(tErr?.message || 'Error al crear torneo.');

      const participantsPayload = availablePlayers.map((p) => ({
        tournament_id: newTourney.id,
        user_id: p.id,
        club_id: p.assigned_club_id!,
      }));

      const { data: insertedParticipants, error: partErr } = await supabase
        .from('tournament_participants')
        .insert(participantsPayload)
        .select();

      if (partErr || !insertedParticipants) throw new Error(partErr?.message);

      const generatedFixture = generateRoundRobinFixture(insertedParticipants as TournamentParticipant[]);

      for (const roundData of generatedFixture) {
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

      await supabase
        .from('tournaments')
        .update({ total_rounds: generatedFixture.length })
        .eq('id', newTourney.id);

      Alert.alert('¡Sorteo Exitoso!', `Se generaron ${generatedFixture.length} jornadas completas.`);
      loadAdminData();
    } catch (err: any) {
      Alert.alert('Error al iniciar torneo', err.message);
    } finally {
      setActionLoading(false);
    }
  };

  /**
   * 2. Control de Jornadas (Switch)
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
   * 3. Edición de Marcadores por Arbitraje
   */
  const handleUpdateMatchScore = async (matchId: string) => {
    const hScore = parseInt(homeScoreInput, 10);
    const aScore = parseInt(awayScoreInput, 10);

    if (isNaN(hScore) || isNaN(aScore) || hScore < 0 || aScore < 0) {
      Alert.alert('Marcador Inválido', 'Ingresa números enteros válidos.');
      return;
    }

    try {
      const { error } = await supabase
        .from('matches')
        .update({
          home_score: hScore,
          away_score: aScore,
          status: 'finished',
          resolved_by: user?.id,
        })
        .eq('id', matchId);

      if (error) throw error;

      Alert.alert('Éxito', 'El resultado fue modificado por el Administrador.');
      setEditingMatchId(null);
      setHomeScoreInput('');
      setAwayScoreInput('');
      loadAdminData();
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  };

  /**
   * 4. Eliminación de Jugador
   */
  const handleDeletePlayer = (player: Player) => {
    Alert.alert(
      'Confirmar Eliminación',
      `¿Deseas eliminar a ${player.name} (${player.position} - OVR ${player.rating})?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase.from('players').delete().eq('id', player.id);
              if (error) throw error;

              Alert.alert('Eliminado', `${player.name} fue borrado correctamente.`);
              if (selectedClubId) fetchPlayersByClub(selectedClubId);
            } catch (err: any) {
              Alert.alert('Error', err.message);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#00ff87" />
        <Text style={styles.loadingText}>Cargando Panel de Control...</Text>
      </View>
    );
  }

  if (profile?.role !== 'admin') {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <LinearGradient colors={['#070a0f', '#161c28']} style={styles.gradient}>
          <View style={styles.unauthorizedBox}>
            <Ionicons name="lock-closed" size={60} color="#f59e0b" />
            <Text style={styles.unauthorizedTitle}>ACCESO RESTRINGIDO</Text>
            <Text style={styles.unauthorizedSubtitle}>
              Módulo exclusivo para administradores del torneo.
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
        <View style={styles.header}>
          <View>
            <Text style={styles.adminTag}>PANEL DE CONTROL</Text>
            <Text style={styles.headerTitle}>ADMINISTRACIÓN DEL TORNEO</Text>
          </View>
          <TouchableOpacity onPress={loadAdminData} style={styles.refreshBtn}>
            <Ionicons name="refresh" size={20} color="#00ff87" />
          </TouchableOpacity>
        </View>

        {/* NAVEGACIÓN POR PESTAÑAS DENTRO DEL PANEL */}
        <View style={styles.tabsRow}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'fixture' && styles.tabBtnActive]}
            onPress={() => setActiveTab('fixture')}
          >
            <Ionicons name="shuffle" size={16} color={activeTab === 'fixture' ? '#070a0f' : '#64748b'} />
            <Text style={[styles.tabBtnText, activeTab === 'fixture' && styles.tabBtnTextActive]}>Fixture</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'results' && styles.tabBtnActive]}
            onPress={() => setActiveTab('results')}
          >
            <Ionicons name="create" size={16} color={activeTab === 'results' ? '#070a0f' : '#64748b'} />
            <Text style={[styles.tabBtnText, activeTab === 'results' && styles.tabBtnTextActive]}>Resultados</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'players' && styles.tabBtnActive]}
            onPress={() => setActiveTab('players')}
          >
            <Ionicons name="people-circle" size={16} color={activeTab === 'players' ? '#070a0f' : '#64748b'} />
            <Text style={[styles.tabBtnText, activeTab === 'players' && styles.tabBtnTextActive]}>Jugadores</Text>
          </TouchableOpacity>
        </View>

        {/* CONTENIDO SEGÚN LA PESTAÑA SELECCIONADA */}
        <View style={{ flex: 1 }}>
          {activeTab === 'fixture' && (
            <ScrollView contentContainerStyle={styles.scroll}>
              {!activeTournament ? (
                <View style={styles.card}>
                  <Ionicons name="trophy" size={40} color="#00ff87" />
                  <Text style={styles.cardTitle}>INICIAR NUEVA TEMPORADA</Text>
                  <Text style={styles.cardDesc}>
                    Genera automáticamente el fixture de ida y vuelta para todos los usuarios registrados.
                  </Text>
                  <TouchableOpacity style={styles.actionBtn} onPress={handleStartTournament} disabled={actionLoading}>
                    <LinearGradient colors={['#00ff87', '#00b4d8']} style={styles.actionBtnGrad}>
                      {actionLoading ? <ActivityIndicator color="#070a0f" /> : <Text style={styles.actionBtnText}>GENERAR FIXTURE IDA Y VUELTA</Text>}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              ) : (
                <View>
                  <Text style={styles.sectionHeading}>HABILITAR FECHAS DE JUEGO</Text>
                  <View style={styles.roundsList}>
                    {rounds.map((round) => (
                      <View key={round.id} style={styles.roundRow}>
                        <View style={styles.roundInfo}>
                          <Text style={styles.roundName}>{round.name}</Text>
                          <Text style={[styles.roundStatus, round.is_active ? styles.roundActive : styles.roundInactive]}>
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
                </View>
              )}
            </ScrollView>
          )}

          {activeTab === 'results' && (
            <FlatList
              data={matches}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 30 }}
              renderItem={({ item }) => {
                const isEditing = editingMatchId === item.id;
                return (
                  <View style={styles.matchCard}>
                    <Text style={styles.roundLabel}>{item.rounds?.name || 'Jornada'}</Text>
                    <View style={styles.matchTeamsRow}>
                      <View style={styles.teamCol}>
                        <Text style={styles.teamName}>{item.home_club?.short_name}</Text>
                        <Text style={styles.userName}>@{item.home_user?.username}</Text>
                      </View>

                      {isEditing ? (
                        <View style={styles.editScoreRow}>
                          <TextInput
                            style={styles.scoreInput}
                            keyboardType="numeric"
                            value={homeScoreInput}
                            onChangeText={setHomeScoreInput}
                          />
                          <Text style={{ color: '#fff', fontWeight: '900' }}>-</Text>
                          <TextInput
                            style={styles.scoreInput}
                            keyboardType="numeric"
                            value={awayScoreInput}
                            onChangeText={setAwayScoreInput}
                          />
                        </View>
                      ) : (
                        <Text style={styles.matchScore}>{item.home_score} - {item.away_score}</Text>
                      )}

                      <View style={styles.teamCol}>
                        <Text style={styles.teamName}>{item.away_club?.short_name}</Text>
                        <Text style={styles.userName}>@{item.away_user?.username}</Text>
                      </View>
                    </View>

                    {isEditing ? (
                      <View style={styles.matchActionsRow}>
                        <TouchableOpacity style={styles.cancelBtn} onPress={() => setEditingMatchId(null)}>
                          <Text style={styles.cancelBtnText}>CANCELAR</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.saveScoreBtn} onPress={() => handleUpdateMatchScore(item.id)}>
                          <Text style={styles.saveScoreBtnText}>GUARDAR</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.editMatchBtn}
                        onPress={() => {
                          setEditingMatchId(item.id);
                          setHomeScoreInput(item.home_score.toString());
                          setAwayScoreInput(item.away_score.toString());
                        }}
                      >
                        <Ionicons name="pencil" size={14} color="#00ff87" />
                        <Text style={styles.editMatchBtnText}>CAMBIAR RESULTADO</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              }}
            />
          )}

          {activeTab === 'players' && (
            <View style={{ flex: 1, paddingHorizontal: 16 }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.clubsRow}>
                {clubs.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.clubChip, selectedClubId === c.id && styles.clubChipActive]}
                    onPress={() => fetchPlayersByClub(c.id)}
                  >
                    <Text style={[styles.clubChipText, selectedClubId === c.id && styles.clubChipTextActive]}>
                      {c.short_name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <FlatList
                data={clubPlayers}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ paddingBottom: 30 }}
                renderItem={({ item }) => (
                  <View style={styles.playerRow}>
                    <View style={styles.playerInfo}>
                      <View style={styles.posTag}>
                        <Text style={styles.posTagText}>{item.position}</Text>
                      </View>
                      <Text style={styles.playerName}>{item.name}</Text>
                      <Text style={styles.playerOvr}>OVR {item.rating}</Text>
                    </View>

                    <TouchableOpacity style={styles.deletePlayerBtn} onPress={() => handleDeletePlayer(item)}>
                      <Ionicons name="trash-outline" size={18} color="#e53e3e" />
                    </TouchableOpacity>
                  </View>
                )}
              />
            </View>
          )}
        </View>
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
    paddingHorizontal: 16,
    marginBottom: 12,
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
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: '#0f172a',
    borderRadius: 12,
    padding: 4,
    marginHorizontal: 16,
    marginBottom: 14,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  tabBtnActive: {
    backgroundColor: '#00ff87',
  },
  tabBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
  },
  tabBtnTextActive: {
    color: '#070a0f',
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
  sectionHeading: {
    fontSize: 14,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 1,
    marginBottom: 12,
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
  matchCard: {
    backgroundColor: '#0f172a',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  roundLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#00ff87',
    marginBottom: 8,
  },
  matchTeamsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  teamCol: {
    alignItems: 'center',
    width: '35%',
  },
  teamName: {
    fontSize: 14,
    fontWeight: '900',
    color: '#ffffff',
  },
  userName: {
    fontSize: 10,
    color: '#64748b',
  },
  matchScore: {
    fontSize: 20,
    fontWeight: '900',
    color: '#00ff87',
  },
  editScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  scoreInput: {
    backgroundColor: '#1e293b',
    color: '#ffffff',
    width: 40,
    height: 36,
    borderRadius: 8,
    textAlign: 'center',
    fontWeight: '900',
    borderWidth: 1,
    borderColor: '#00ff87',
  },
  editMatchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  editMatchBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#00ff87',
  },
  matchActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 10,
  },
  cancelBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  cancelBtnText: {
    fontSize: 10,
    color: '#e53e3e',
    fontWeight: '800',
  },
  saveScoreBtn: {
    backgroundColor: '#00ff87',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  saveScoreBtnText: {
    fontSize: 10,
    color: '#070a0f',
    fontWeight: '900',
  },
  clubsRow: {
    flexDirection: 'row',
    maxHeight: 40,
    marginBottom: 12,
  },
  clubChip: {
    backgroundColor: '#0f172a',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  clubChipActive: {
    backgroundColor: '#00ff87',
  },
  clubChipText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
  },
  clubChipTextActive: {
    color: '#070a0f',
  },
  playerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  playerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  posTag: {
    backgroundColor: 'rgba(0, 255, 135, 0.1)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 135, 0.3)',
  },
  posTagText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#00ff87',
  },
  playerName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
  },
  playerOvr: {
    fontSize: 10,
    color: '#64748b',
  },
  deletePlayerBtn: {
    padding: 6,
    backgroundColor: 'rgba(229, 62, 62, 0.1)',
    borderRadius: 8,
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