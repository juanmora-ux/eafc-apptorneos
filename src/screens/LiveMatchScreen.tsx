import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ScreenOrientation from 'expo-screen-orientation';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { Match, MatchEvent, Player } from '../types/database';

interface LiveMatchScreenProps {
  match: Match;
  onExit: () => void;
}

export const LiveMatchScreen: React.FC<LiveMatchScreenProps> = ({ match: initialMatch, onExit }) => {
  const { user } = useAuth();

  const [currentMatch, setCurrentMatch] = useState<Match>(initialMatch);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [mySquad, setMySquad] = useState<Player[]>([]);
  const [matchMinute, setMatchMinute] = useState<number>(45);
  const [loading, setLoading] = useState(true);

  // Estados para Handshake de Validación Cruzada
  const [showHandshakeModal, setShowHandshakeModal] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [showDisputeInput, setShowDisputeInput] = useState(false);
  const [handshakeLoading, setHandshakeLoading] = useState(false);

  // Selector de Jugador para registrar evento
  const [selectedEventType, setSelectedEventType] = useState<'goal' | 'yellow_card' | 'red_card' | null>(null);
  const [showPlayerPicker, setShowPlayerPicker] = useState(false);

  // Identificación de roles
  const isHomeUser = currentMatch.home_user_id === user?.id;
  const isAwayUser = currentMatch.away_user_id === user?.id;
  const isParticipant = isHomeUser || isAwayUser;

  const myClubId = isHomeUser ? currentMatch.home_club_id : isAwayUser ? currentMatch.away_club_id : null;
  const myClubName = isHomeUser ? currentMatch.home_club?.name : isAwayUser ? currentMatch.away_club?.name : 'Espectador';

  /**
   * 1. Bloqueo obligatorio en Orientación Horizontal (Landscape) al montar,
   * y restauración a Vertical (Portrait) al desmontar el componente.
   */
  useEffect(() => {
    async function lockLandscape() {
      try {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      } catch (err) {
        console.warn('Error locking landscape orientation:', err);
      }
    }

    lockLandscape();

    return () => {
      // Restauración automática a vertical al salir
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    };
  }, []);

  // 2. Cargar eventos previos del partido y plantilla del equipo propio
  const loadMatchData = useCallback(async () => {
    try {
      // Eventos
      const { data: eventsData } = await supabase
        .from('match_events')
        .select('*, players(name, position)')
        .eq('match_id', currentMatch.id)
        .order('minute', { ascending: false });

      if (eventsData) setEvents(eventsData as MatchEvent[]);

      // Plantilla propia para asignar autores de goles/tarjetas
      if (myClubId) {
        const { data: playersData } = await supabase
          .from('players')
          .select('*')
          .eq('club_id', myClubId)
          .order('rating', { ascending: false });

        if (playersData) setMySquad(playersData as Player[]);
      }
    } catch (e) {
      console.error('Error loading match data:', e);
    } finally {
      setLoading(false);
    }
  }, [currentMatch.id, myClubId]);

  useEffect(() => {
    loadMatchData();
  }, [loadMatchData]);

  /**
   * 3. Supabase Realtime (WebSockets):
   * Sincronización bidireccional inmediata para goles, tarjetas y Handshake.
   */
  useEffect(() => {
    const channel = supabase
      .channel(`live_match_${currentMatch.id}`)
      // Escuchar cambios en la tabla 'matches' (ej: actualización de marcador o cambio a pending_approval)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'matches',
          filter: `id=eq.${currentMatch.id}`,
        },
        (payload) => {
          const updated = payload.new as Match;
          setCurrentMatch((prev) => ({ ...prev, ...updated }));

          // Si el visitante detecta que el local pasó el partido a 'pending_approval', abrir handshake
          if (isAwayUser && updated.status === 'pending_approval') {
            setShowHandshakeModal(true);
          }
        }
      )
      // Escuchar nuevos eventos en vivo (goles, tarjetas)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'match_events',
          filter: `match_id=eq.${currentMatch.id}`,
        },
        () => {
          loadMatchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentMatch.id, isAwayUser, loadMatchData]);

  // Si el partido ya estaba en pending_approval cuando el visitante entra, mostrar handshake
  useEffect(() => {
    if (isAwayUser && currentMatch.status === 'pending_approval') {
      setShowHandshakeModal(true);
    }
  }, [isAwayUser, currentMatch.status]);

  /**
   * 4. Registro de Eventos con Restricción Estricta (Equipo Propio)
   */
  const handleRegisterEvent = async (player: Player) => {
    if (!myClubId || !user?.id) return;

    if (currentMatch.status !== 'live' && currentMatch.status !== 'scheduled') {
      Alert.alert('Acción no permitida', 'Solo se pueden registrar eventos cuando el partido está en juego.');
      return;
    }

    try {
      // Si el partido estaba 'scheduled', al registrar el primer evento pasa a 'live'
      if (currentMatch.status === 'scheduled') {
        await supabase.from('matches').update({ status: 'live' }).eq('id', currentMatch.id);
      }

      // Inserción validada por la política RLS 'Strict team event registration'
      const { error } = await supabase.from('match_events').insert({
        match_id: currentMatch.id,
        user_id: user.id,
        club_id: myClubId,
        player_id: player.id,
        event_type: selectedEventType!,
        minute: matchMinute,
      });

      if (error) {
        Alert.alert('Error de Seguridad RLS', error.message);
      } else {
        setShowPlayerPicker(false);
        setSelectedEventType(null);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  /**
   * 5. Handshake: Local envía marcador final
   */
  const handleLocalSubmitFinalScore = async () => {
    Alert.alert(
      'Finalizar Encuentro',
      `¿Deseas reportar el marcador final (${currentMatch.home_score} - ${currentMatch.away_score}) y notificar al visitante?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Enviar Resultado',
          onPress: async () => {
            setHandshakeLoading(true);
            try {
              const { error } = await supabase
                .from('matches')
                .update({
                  status: 'pending_approval',
                  local_submitted_at: new Date().toISOString(),
                })
                .eq('id', currentMatch.id);

              if (error) {
                Alert.alert('Error', error.message);
              } else {
                Alert.alert(
                  'Resultado Enviado',
                  'Se ha notificado al equipo visitante por WebSockets para la aprobación del marcador.'
                );
              }
            } finally {
              setHandshakeLoading(false);
            }
          },
        },
      ]
    );
  };

  /**
   * 6. Handshake: Visitante Aprueba o Disputa
   */
  const handleVisitorReview = async (approved: boolean) => {
    setHandshakeLoading(true);
    try {
      if (approved) {
        // Aprobado -> Pasa a 'finished'
        const { error } = await supabase
          .from('matches')
          .update({
            status: 'finished',
            visitor_reviewed_at: new Date().toISOString(),
          })
          .eq('id', currentMatch.id);

        if (error) {
          Alert.alert('Error', error.message);
        } else {
          setShowHandshakeModal(false);
          Alert.alert('¡Marcador Oficializado!', 'El partido ha finalizado y se ha sumado a la tabla de posiciones.');
        }
      } else {
        // Rechazado -> Pasa a 'disputed'
        if (!disputeReason.trim()) {
          Alert.alert('Motivo Requerido', 'Por favor describe el motivo de la discrepancia.');
          setHandshakeLoading(false);
          return;
        }

        const { error } = await supabase
          .from('matches')
          .update({
            status: 'disputed',
            dispute_reason: disputeReason.trim(),
            visitor_reviewed_at: new Date().toISOString(),
          })
          .eq('id', currentMatch.id);

        if (error) {
          Alert.alert('Error', error.message);
        } else {
          setShowHandshakeModal(false);
          setShowDisputeInput(false);
          Alert.alert(
            'Partido en Disputa',
            'El partido ha quedado congelado en estado de Disputa. El Administrador revisará el encuentro.'
          );
        }
      }
    } finally {
      setHandshakeLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <LinearGradient colors={['#05080e', '#0b111d', '#050c18']} style={styles.gradient}>
        {/* Barra Superior Horizontal */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={onExit} style={styles.exitButton}>
            <Ionicons name="arrow-back" size={20} color="#ffffff" />
            <Text style={styles.exitText}>SALIR</Text>
          </TouchableOpacity>

          <View style={styles.statusIndicator}>
            <View
              style={[
                styles.pulseDot,
                currentMatch.status === 'live'
                  ? styles.pulseLive
                  : currentMatch.status === 'pending_approval'
                  ? styles.pulsePending
                  : styles.pulseFinished,
              ]}
            />
            <Text style={styles.statusLabel}>
              {currentMatch.status === 'live'
                ? 'PARTIDO EN VIVO'
                : currentMatch.status === 'pending_approval'
                ? 'ESPERANDO VALIDACIÓN VISITANTE'
                : currentMatch.status === 'disputed'
                ? 'EN DISPUTA (ARBITRAJE)'
                : currentMatch.status === 'finished'
                ? 'FINALIZADO'
                : 'PROGRAMADO'}
            </Text>
          </View>

          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>
              ROL: {isHomeUser ? 'LOCAL' : isAwayUser ? 'VISITANTE' : 'ESPECTADOR'}
            </Text>
          </View>
        </View>

        {/* Panel Principal Dividido en 3 Columnas Horizontales */}
        <View style={styles.mainLayout}>
          {/* COLUMNA 1: EQUIPO LOCAL */}
          <View style={[styles.teamColumn, isHomeUser && styles.myTeamHighlight]}>
            <View style={styles.teamHeader}>
              {currentMatch.home_club?.logo_url && (
                <Image source={{ uri: currentMatch.home_club.logo_url }} style={styles.clubLogo} resizeMode="contain" />
              )}
              <Text style={styles.clubName} numberOfLines={1}>
                {currentMatch.home_club?.name}
              </Text>
              <Text style={styles.gamerTag}>@{currentMatch.home_user?.username}</Text>
            </View>

            {/* Botones de Evento (Habilitados estrictamente si es usuario local) */}
            <View style={styles.eventButtonsGrid}>
              <TouchableOpacity
                style={[styles.eventBtn, styles.goalBtn, !isHomeUser && styles.btnDisabled]}
                disabled={!isHomeUser}
                onPress={() => {
                  setSelectedEventType('goal');
                  setShowPlayerPicker(true);
                }}
              >
                <Ionicons name="football" size={16} color="#070a0f" />
                <Text style={styles.goalBtnText}>+ GOL LOCAL</Text>
              </TouchableOpacity>

              <View style={styles.cardButtonsRow}>
                <TouchableOpacity
                  style={[styles.cardBtn, styles.yellowCardBtn, !isHomeUser && styles.btnDisabled]}
                  disabled={!isHomeUser}
                  onPress={() => {
                    setSelectedEventType('yellow_card');
                    setShowPlayerPicker(true);
                  }}
                >
                  <View style={styles.yellowCardIcon} />
                  <Text style={styles.cardBtnText}>AMARILLA</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.cardBtn, styles.redCardBtn, !isHomeUser && styles.btnDisabled]}
                  disabled={!isHomeUser}
                  onPress={() => {
                    setSelectedEventType('red_card');
                    setShowPlayerPicker(true);
                  }}
                >
                  <View style={styles.redCardIcon} />
                  <Text style={styles.cardBtnText}>ROJA</Text>
                </TouchableOpacity>
              </View>
            </View>

            {!isHomeUser && (
              <Text style={styles.restrictedNotice}>
                <Ionicons name="lock-closed" size={10} color="#64748b" /> Solo modificable por el equipo local
              </Text>
            )}
          </View>

          {/* COLUMNA 2: MARCADOR CENTRAL Y TIMELINE DE EVENTOS */}
          <View style={styles.centerColumn}>
            <View style={styles.scoreBoard}>
              <Text style={styles.scoreNumber}>{currentMatch.home_score}</Text>
              <Text style={styles.scoreSeparator}>-</Text>
              <Text style={styles.scoreNumber}>{currentMatch.away_score}</Text>
            </View>

            <View style={styles.minuteBadge}>
              <Ionicons name="time-outline" size={14} color="#00ff87" />
              <Text style={styles.minuteText}>Minuto: {matchMinute}'</Text>
            </View>

            {/* Botón de Handshake para el Local */}
            {isHomeUser && currentMatch.status !== 'finished' && currentMatch.status !== 'pending_approval' && (
              <TouchableOpacity
                style={styles.finishMatchBtn}
                onPress={handleLocalSubmitFinalScore}
                disabled={handshakeLoading}
              >
                <Text style={styles.finishMatchBtnText}>FINALIZAR Y ENVIAR RESULTADO</Text>
              </TouchableOpacity>
            )}

            {/* Timeline de Eventos en Vivo */}
            <Text style={styles.timelineTitle}>LÍNEA DE TIEMPO DEL PARTIDO</Text>
            <ScrollView style={styles.timelineScroll} showsVerticalScrollIndicator={false}>
              {events.length === 0 ? (
                <Text style={styles.noEventsText}>Esperando goles o incidencias...</Text>
              ) : (
                events.map((ev) => (
                  <View key={ev.id} style={styles.timelineItem}>
                    <Text style={styles.timelineMin}>{ev.minute}'</Text>
                    {ev.event_type === 'goal' ? (
                      <Ionicons name="football" size={14} color="#00ff87" />
                    ) : ev.event_type === 'yellow_card' ? (
                      <View style={styles.miniYellow} />
                    ) : (
                      <View style={styles.miniRed} />
                    )}
                    <Text style={styles.timelinePlayer} numberOfLines={1}>
                      {ev.players?.name || 'Jugador'} ({ev.players?.position})
                    </Text>
                  </View>
                ))
              )}
            </ScrollView>
          </View>

          {/* COLUMNA 3: EQUIPO VISITANTE */}
          <View style={[styles.teamColumn, isAwayUser && styles.myTeamHighlight]}>
            <View style={styles.teamHeader}>
              {currentMatch.away_club?.logo_url && (
                <Image source={{ uri: currentMatch.away_club.logo_url }} style={styles.clubLogo} resizeMode="contain" />
              )}
              <Text style={styles.clubName} numberOfLines={1}>
                {currentMatch.away_club?.name}
              </Text>
              <Text style={styles.gamerTag}>@{currentMatch.away_user?.username}</Text>
            </View>

            {/* Botones de Evento (Habilitados estrictamente si es usuario visitante) */}
            <View style={styles.eventButtonsGrid}>
              <TouchableOpacity
                style={[styles.eventBtn, styles.goalBtn, !isAwayUser && styles.btnDisabled]}
                disabled={!isAwayUser}
                onPress={() => {
                  setSelectedEventType('goal');
                  setShowPlayerPicker(true);
                }}
              >
                <Ionicons name="football" size={16} color="#070a0f" />
                <Text style={styles.goalBtnText}>+ GOL VISITANTE</Text>
              </TouchableOpacity>

              <View style={styles.cardButtonsRow}>
                <TouchableOpacity
                  style={[styles.cardBtn, styles.yellowCardBtn, !isAwayUser && styles.btnDisabled]}
                  disabled={!isAwayUser}
                  onPress={() => {
                    setSelectedEventType('yellow_card');
                    setShowPlayerPicker(true);
                  }}
                >
                  <View style={styles.yellowCardIcon} />
                  <Text style={styles.cardBtnText}>AMARILLA</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.cardBtn, styles.redCardBtn, !isAwayUser && styles.btnDisabled]}
                  disabled={!isAwayUser}
                  onPress={() => {
                    setSelectedEventType('red_card');
                    setShowPlayerPicker(true);
                  }}
                >
                  <View style={styles.redCardIcon} />
                  <Text style={styles.cardBtnText}>ROJA</Text>
                </TouchableOpacity>
              </View>
            </View>

            {!isAwayUser && (
              <Text style={styles.restrictedNotice}>
                <Ionicons name="lock-closed" size={10} color="#64748b" /> Solo modificable por el equipo visitante
              </Text>
            )}
          </View>
        </View>

        {/* MODAL 1: SELECTOR DE JUGADOR DE LA PLANTILLA PROPIA */}
        <Modal visible={showPlayerPicker} transparent animationType="fade">
          <View style={styles.modalBackdrop}>
            <View style={styles.pickerCard}>
              <View style={styles.pickerHeader}>
                <Text style={styles.pickerTitle}>
                  {selectedEventType === 'goal'
                    ? '¿QUIÉN ANOTÓ EL GOL?'
                    : selectedEventType === 'yellow_card'
                    ? 'TARJETA AMARILLA'
                    : 'TARJETA ROJA'}
                </Text>
                <TouchableOpacity onPress={() => setShowPlayerPicker(false)}>
                  <Ionicons name="close" size={24} color="#ffffff" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.playersList}>
                {mySquad.map((player) => (
                  <TouchableOpacity
                    key={player.id}
                    style={styles.playerItem}
                    onPress={() => handleRegisterEvent(player)}
                  >
                    <Text style={styles.playerPosBadge}>{player.position}</Text>
                    <Text style={styles.playerNameText}>{player.name}</Text>
                    <Text style={styles.playerRatingText}>{player.rating} OVR</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* MODAL 2: HANDSHAKE REACTIVO PARA EL EQUIPO VISITANTE */}
        <Modal visible={showHandshakeModal} transparent animationType="slide">
          <View style={styles.modalBackdrop}>
            <View style={styles.handshakeCard}>
              <Ionicons name="shield-checkmark" size={40} color="#00ff87" />
              <Text style={styles.handshakeTitle}>HANDSHAKE: VALIDACIÓN DE RESULTADO</Text>
              <Text style={styles.handshakeDesc}>
                El equipo local ha reportado el resultado final del partido:
              </Text>

              <View style={styles.handshakeScoreBox}>
                <Text style={styles.handshakeScoreText}>
                  {currentMatch.home_club?.name}: {currentMatch.home_score}
                </Text>
                <Text style={styles.handshakeScoreText}>
                  {currentMatch.away_club?.name}: {currentMatch.away_score}
                </Text>
              </View>

              {!showDisputeInput ? (
                <View style={styles.handshakeActions}>
                  <TouchableOpacity
                    style={styles.approveBtn}
                    onPress={() => handleVisitorReview(true)}
                    disabled={handshakeLoading}
                  >
                    <Ionicons name="checkmark-circle" size={18} color="#070a0f" />
                    <Text style={styles.approveBtnText}>APROBAR MARCADOR</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.disputeBtn}
                    onPress={() => setShowDisputeInput(true)}
                    disabled={handshakeLoading}
                  >
                    <Ionicons name="close-circle" size={18} color="#ffffff" />
                    <Text style={styles.disputeBtnText}>RECHAZAR (DISPUTA)</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.disputeForm}>
                  <TextInput
                    style={styles.disputeInput}
                    placeholder="Escribe el motivo del reclamo (ej: el local anotó un gol inválido)"
                    placeholderTextColor="#64748b"
                    value={disputeReason}
                    onChangeText={setDisputeReason}
                    multiline
                  />
                  <TouchableOpacity
                    style={styles.confirmDisputeBtn}
                    onPress={() => handleVisitorReview(false)}
                    disabled={handshakeLoading}
                  >
                    {handshakeLoading ? (
                      <ActivityIndicator color="#ffffff" />
                    ) : (
                      <Text style={styles.confirmDisputeBtnText}>CONFIRMAR DISPUTA Y ENVIAR A ADMIN</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </Modal>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#05080e',
  },
  gradient: {
    flex: 1,
    padding: 10,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  exitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  exitText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ffffff',
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  pulseLive: {
    backgroundColor: '#ef4444',
  },
  pulsePending: {
    backgroundColor: '#f59e0b',
  },
  pulseFinished: {
    backgroundColor: '#00ff87',
  },
  statusLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 1,
  },
  roleBadge: {
    backgroundColor: 'rgba(0, 255, 135, 0.1)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 135, 0.3)',
  },
  roleText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#00ff87',
  },
  mainLayout: {
    flex: 1,
    flexDirection: 'row',
    marginTop: 8,
    gap: 10,
  },
  teamColumn: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    padding: 10,
    justifyContent: 'space-between',
  },
  myTeamHighlight: {
    borderColor: 'rgba(0, 255, 135, 0.4)',
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
  },
  teamHeader: {
    alignItems: 'center',
  },
  clubLogo: {
    width: 44,
    height: 44,
    marginBottom: 4,
  },
  clubName: {
    fontSize: 14,
    fontWeight: '900',
    color: '#ffffff',
    textAlign: 'center',
  },
  gamerTag: {
    fontSize: 10,
    color: '#64748b',
  },
  eventButtonsGrid: {
    gap: 6,
    marginVertical: 6,
  },
  eventBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  goalBtn: {
    backgroundColor: '#00ff87',
  },
  goalBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#070a0f',
  },
  cardButtonsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  cardBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 7,
    borderRadius: 8,
    gap: 4,
    backgroundColor: '#1e293b',
  },
  yellowCardBtn: {
    borderWidth: 1,
    borderColor: '#eab308',
  },
  redCardBtn: {
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  yellowCardIcon: {
    width: 8,
    height: 12,
    backgroundColor: '#eab308',
    borderRadius: 2,
  },
  redCardIcon: {
    width: 8,
    height: 12,
    backgroundColor: '#ef4444',
    borderRadius: 2,
  },
  cardBtnText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#ffffff',
  },
  btnDisabled: {
    opacity: 0.35,
  },
  restrictedNotice: {
    fontSize: 8,
    color: '#64748b',
    textAlign: 'center',
  },
  centerColumn: {
    flex: 1.2,
    backgroundColor: '#0a0f1d',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    padding: 10,
    alignItems: 'center',
  },
  scoreBoard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  scoreNumber: {
    fontSize: 38,
    fontWeight: '900',
    color: '#ffffff',
  },
  scoreSeparator: {
    fontSize: 28,
    fontWeight: '900',
    color: '#64748b',
  },
  minuteBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  minuteText: {
    fontSize: 11,
    color: '#00ff87',
    fontWeight: '700',
  },
  finishMatchBtn: {
    backgroundColor: '#f59e0b',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  finishMatchBtnText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#070a0f',
  },
  timelineTitle: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 1,
    marginBottom: 4,
  },
  timelineScroll: {
    width: '100%',
    flex: 1,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    gap: 6,
  },
  timelineMin: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94a3b8',
    width: 22,
  },
  timelinePlayer: {
    fontSize: 10,
    color: '#ffffff',
    flex: 1,
  },
  miniYellow: {
    width: 6,
    height: 9,
    backgroundColor: '#eab308',
    borderRadius: 1,
  },
  miniRed: {
    width: 6,
    height: 9,
    backgroundColor: '#ef4444',
    borderRadius: 1,
  },
  noEventsText: {
    fontSize: 10,
    color: '#475569',
    textAlign: 'center',
    marginTop: 10,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  pickerCard: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#00ff87',
    width: '80%',
    maxHeight: '85%',
    padding: 16,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  pickerTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#00ff87',
  },
  playersList: {
    maxHeight: 180,
  },
  playerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
    gap: 10,
  },
  playerPosBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: '#00ff87',
    width: 32,
  },
  playerNameText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
    flex: 1,
  },
  playerRatingText: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '700',
  },
  handshakeCard: {
    backgroundColor: '#0f172a',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#00ff87',
    padding: 20,
    alignItems: 'center',
    width: '85%',
  },
  handshakeTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#ffffff',
    marginTop: 8,
    textAlign: 'center',
  },
  handshakeDesc: {
    fontSize: 11,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 4,
  },
  handshakeScoreBox: {
    backgroundColor: '#070a0f',
    padding: 10,
    borderRadius: 10,
    marginVertical: 12,
    width: '100%',
    alignItems: 'center',
  },
  handshakeScoreText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#00ff87',
  },
  handshakeActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  approveBtn: {
    flex: 1,
    backgroundColor: '#00ff87',
    paddingVertical: 10,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  approveBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#070a0f',
  },
  disputeBtn: {
    flex: 1,
    backgroundColor: '#ef4444',
    paddingVertical: 10,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  disputeBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#ffffff',
  },
  disputeForm: {
    width: '100%',
    gap: 10,
  },
  disputeInput: {
    backgroundColor: '#070a0f',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    color: '#ffffff',
    padding: 10,
    fontSize: 11,
    height: 60,
  },
  confirmDisputeBtn: {
    backgroundColor: '#f59e0b',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  confirmDisputeBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#070a0f',
  },
});
