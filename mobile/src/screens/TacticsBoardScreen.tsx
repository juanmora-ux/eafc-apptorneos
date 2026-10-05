import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { Player } from '../types/database';
import { PitchCanvas } from '../components/PitchCanvas';
import { DraggablePlayerToken, TokenBounds } from '../components/DraggablePlayerToken';

const { width } = Dimensions.get('window');
const PITCH_WIDTH = width - 32;
const PITCH_HEIGHT = PITCH_WIDTH * 1.38;

const BOUNDS: TokenBounds = {
  minX: 12,
  maxX: PITCH_WIDTH - 58,
  minY: 12,
  maxY: PITCH_HEIGHT - 62,
};

const FORMATIONS: Record<string, { label: string; coords: { x: number; y: number; pos: string }[] }> = {
  '4-3-3': {
    label: '4-3-3 (Ofensiva)',
    coords: [
      { x: 0.50, y: 0.88, pos: 'GK' },
      { x: 0.15, y: 0.72, pos: 'LB' },
      { x: 0.38, y: 0.75, pos: 'CB' },
      { x: 0.62, y: 0.75, pos: 'CB' },
      { x: 0.85, y: 0.72, pos: 'RB' },
      { x: 0.50, y: 0.56, pos: 'CDM' },
      { x: 0.28, y: 0.42, pos: 'CM' },
      { x: 0.72, y: 0.42, pos: 'CM' },
      { x: 0.18, y: 0.22, pos: 'LW' },
      { x: 0.50, y: 0.15, pos: 'ST' },
      { x: 0.82, y: 0.22, pos: 'RW' },
    ],
  },
  '4-4-2': {
    label: '4-4-2 (Clásica)',
    coords: [
      { x: 0.50, y: 0.88, pos: 'GK' },
      { x: 0.15, y: 0.72, pos: 'LB' },
      { x: 0.38, y: 0.75, pos: 'CB' },
      { x: 0.62, y: 0.75, pos: 'CB' },
      { x: 0.85, y: 0.72, pos: 'RB' },
      { x: 0.15, y: 0.46, pos: 'LM' },
      { x: 0.38, y: 0.50, pos: 'CM' },
      { x: 0.62, y: 0.50, pos: 'CM' },
      { x: 0.85, y: 0.46, pos: 'RM' },
      { x: 0.36, y: 0.20, pos: 'ST' },
      { x: 0.64, y: 0.20, pos: 'ST' },
    ],
  },
  '3-5-2': {
    label: '3-5-2 (Dominio Medio)',
    coords: [
      { x: 0.50, y: 0.88, pos: 'GK' },
      { x: 0.25, y: 0.75, pos: 'CB' },
      { x: 0.50, y: 0.77, pos: 'CB' },
      { x: 0.75, y: 0.75, pos: 'CB' },
      { x: 0.12, y: 0.48, pos: 'LWB' },
      { x: 0.36, y: 0.54, pos: 'CDM' },
      { x: 0.64, y: 0.54, pos: 'CDM' },
      { x: 0.88, y: 0.48, pos: 'RWB' },
      { x: 0.50, y: 0.36, pos: 'CAM' },
      { x: 0.36, y: 0.18, pos: 'ST' },
      { x: 0.64, y: 0.18, pos: 'ST' },
    ],
  },
};

const computeFormationPositions = (
  formationKey: string,
  currentPlayers: Player[]
): Record<string, { x: number; y: number; pos: string }> => {
  const formConfig = FORMATIONS[formationKey] || FORMATIONS['4-3-3'];
  const newMap: Record<string, { x: number; y: number; pos: string }> = {};

  currentPlayers.forEach((player, index) => {
    const coord = formConfig.coords[index] || { x: 0.5, y: 0.5, pos: player.position };
    newMap[player.id] = {
      x: Math.min(Math.max(coord.x * PITCH_WIDTH - 23, BOUNDS.minX), BOUNDS.maxX),
      y: Math.min(Math.max(coord.y * PITCH_HEIGHT - 27, BOUNDS.minY), BOUNDS.maxY),
      pos: coord.pos,
    };
  });

  return newMap;
};

export const TacticsBoardScreen: React.FC = () => {
  const { user, profile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedFormation, setSelectedFormation] = useState<string>('4-3-3');
  const [playerPositions, setPlayerPositions] = useState<
    Record<string, { x: number; y: number; pos: string }>
  >({});

  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const handleApplyFormation = (formationKey: string) => {
    setSelectedFormation(formationKey);
    if (players.length === 0) return;
    setPlayerPositions(computeFormationPositions(formationKey, players));
  };

  const loadTacticsData = useCallback(async () => {
    const clubId = profile?.assigned_club_id;
    const userId = user?.id;

    if (!clubId || !userId) {
      if (isMounted.current) setLoading(false);
      return;
    }

    try {
      const { data: playersData, error: playersError } = await supabase
        .from('players')
        .select('*')
        .eq('club_id', clubId)
        .order('rating', { ascending: false })
        .limit(11);

      if (playersError) throw playersError;

      const teamPlayers = (playersData as Player[]) || [];

      if (!isMounted.current) return;
      setPlayers(teamPlayers);

      if (teamPlayers.length === 0) {
        setLoading(false);
        return;
      }

      const { data: savedTactic } = await supabase
        .from('tactics')
        .select('*')
        .eq('user_id', userId)
        .eq('club_id', clubId)
        .maybeSingle();

      if (!isMounted.current) return;

      if (savedTactic && savedTactic.positions && savedTactic.positions.length > 0) {
        const activeFormation = savedTactic.formation || '4-3-3';
        setSelectedFormation(activeFormation);
        const posMap: Record<string, { x: number; y: number; pos: string }> = {};

        savedTactic.positions.forEach((p: any) => {
          if (p.player_id) {
            posMap[p.player_id] = {
              x: Math.min(Math.max(p.x * PITCH_WIDTH, BOUNDS.minX), BOUNDS.maxX),
              y: Math.min(Math.max(p.y * PITCH_HEIGHT, BOUNDS.minY), BOUNDS.maxY),
              pos: p.position_label || 'CM',
            };
          }
        });

        const formConfig = FORMATIONS[activeFormation] || FORMATIONS['4-3-3'];
        teamPlayers.forEach((player, idx) => {
          if (!posMap[player.id]) {
            const fallbackCoord = formConfig.coords[idx] || { x: 0.5, y: 0.5, pos: player.position };
            posMap[player.id] = {
              x: Math.min(Math.max(fallbackCoord.x * PITCH_WIDTH - 23, BOUNDS.minX), BOUNDS.maxX),
              y: Math.min(Math.max(fallbackCoord.y * PITCH_HEIGHT - 27, BOUNDS.minY), BOUNDS.maxY),
              pos: fallbackCoord.pos,
            };
          }
        });

        setPlayerPositions(posMap);
      } else {
        setSelectedFormation('4-3-3');
        setPlayerPositions(computeFormationPositions('4-3-3', teamPlayers));
      }
    } catch (err) {
      console.error('Error cargando pizarra táctica:', err);
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, [profile?.assigned_club_id, user?.id]);

  useEffect(() => {
    loadTacticsData();
  }, [loadTacticsData]);

  const handlePositionChange = (playerId: string, newX: number, newY: number) => {
    setPlayerPositions((prev) => ({
      ...prev,
      [playerId]: {
        ...prev[playerId],
        x: newX,
        y: newY,
      },
    }));
  };

  const handleSaveTactics = async () => {
    if (!user?.id || !profile?.assigned_club_id) return;

    setSaving(true);
    try {
      const positionsPayload = players.map((player) => {
        const current = playerPositions[player.id] || { x: 0, y: 0, pos: player.position };
        return {
          player_id: player.id,
          x: Number((current.x / PITCH_WIDTH).toFixed(4)),
          y: Number((current.y / PITCH_HEIGHT).toFixed(4)),
          is_starter: true,
          position_label: current.pos,
        };
      });

      const { error } = await supabase.from('tactics').upsert(
        {
          user_id: user.id,
          club_id: profile.assigned_club_id,
          formation: selectedFormation,
          positions: positionsPayload,
        },
        { onConflict: 'user_id,club_id' }
      );

      if (error) {
        Alert.alert('Error', error.message);
      } else {
        Alert.alert('¡Táctica Guardada!', 'Tu formación y coordenadas han sido guardadas con éxito.');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      if (isMounted.current) setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#00ff87" />
        <Text style={styles.loadingText}>Cargando Pizarra Táctica...</Text>
      </View>
    );
  }

  if (!profile?.assigned_club_id) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="shield-outline" size={60} color="#64748b" />
        <Text style={styles.emptyTitle}>SIN CLUB ASIGNADO</Text>
        <Text style={styles.emptySubtitle}>
          Gira la ruleta de asignación primero para obtener tu club del torneo.
        </Text>
      </View>
    );
  }

  if (players.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Ionicons name="people-outline" size={60} color="#64748b" />
        <Text style={styles.emptyTitle}>PLANTILLA NO ENCONTRADA</Text>
        <Text style={styles.emptySubtitle}>
          No se encontraron jugadores registrados para este club en la base de datos.
        </Text>
        <TouchableOpacity style={styles.retryBtn} onPress={loadTacticsData}>
          <Text style={styles.retryBtnText}>REINTENTAR</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient colors={['#070a0f', '#0c1322', '#061320']} style={styles.gradient}>
        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>PIZARRA TÁCTICA 2D</Text>
              <Text style={styles.subtitle}>DRAG & DROP ABSOLUTO (CANVAS 2D & REANIMATED)</Text>
            </View>
            <TouchableOpacity
              style={styles.saveBtn}
              onPress={handleSaveTactics}
              disabled={saving}
              activeOpacity={0.8}
            >
              {saving ? (
                <ActivityIndicator color="#070a0f" size="small" />
              ) : (
                <>
                  <Ionicons name="cloud-upload" size={16} color="#070a0f" />
                  <Text style={styles.saveBtnText}>GUARDAR</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Selector de Formaciones */}
          <View style={styles.formationsBar}>
            {Object.keys(FORMATIONS).map((formKey) => {
              const isSelected = selectedFormation === formKey;
              return (
                <TouchableOpacity
                  key={formKey}
                  style={[styles.formationChip, isSelected && styles.formationChipSelected]}
                  onPress={() => handleApplyFormation(formKey)}
                >
                  <Text
                    style={[
                      styles.formationChipText,
                      isSelected && styles.formationChipTextSelected,
                    ]}
                  >
                    {formKey}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Campo de fútbol con fichas */}
          <View style={[styles.pitchWrapper, { width: PITCH_WIDTH, height: PITCH_HEIGHT }]}>
            <PitchCanvas width={PITCH_WIDTH} height={PITCH_HEIGHT} />

            {players.map((player) => {
              const currentPos = playerPositions[player.id];
              if (!currentPos) return null;

              return (
                <DraggablePlayerToken
                  key={player.id}
                  player={player}
                  positionLabel={currentPos.pos}
                  initialX={currentPos.x}
                  initialY={currentPos.y}
                  bounds={BOUNDS}
                  onPositionChange={handlePositionChange}
                />
              );
            })}
          </View>

          <View style={styles.tipsBox}>
            <Ionicons name="information-circle" size={16} color="#00ff87" />
            <Text style={styles.tipsText}>
              Arrastra las fichas de los jugadores sobre el campo a 60 FPS. Las coordenadas están
              restringidas dentro de las líneas de cal.
            </Text>
          </View>
        </ScrollView>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#070a0f' },
  gradient: { flex: 1, paddingTop: 45 },
  scroll: { paddingHorizontal: 16, paddingBottom: 30, alignItems: 'center' },
  header: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: { fontSize: 20, fontWeight: '900', color: '#ffffff', letterSpacing: 1.5 },
  subtitle: { fontSize: 9, fontWeight: '700', color: '#00ff87', letterSpacing: 1.5, marginTop: 2 },
  saveBtn: {
    backgroundColor: '#00ff87',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    gap: 6,
  },
  saveBtnText: { fontSize: 11, fontWeight: '900', color: '#070a0f' },
  formationsBar: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 14,
  },
  formationChip: {
    backgroundColor: '#0f172a',
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  formationChipSelected: {
    borderColor: '#00ff87',
    backgroundColor: 'rgba(0, 255, 135, 0.12)',
  },
  formationChipText: { fontSize: 12, fontWeight: '700', color: '#94a3b8' },
  formationChipTextSelected: { color: '#00ff87', fontWeight: '900' },
  pitchWrapper: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  tipsBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    gap: 8,
  },
  tipsText: { flex: 1, fontSize: 11, color: '#94a3b8', lineHeight: 16 },
  centerContainer: {
    flex: 1,
    backgroundColor: '#070a0f',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: { color: '#00ff87', marginTop: 12, fontSize: 13 },
  emptyTitle: { fontSize: 16, fontWeight: '900', color: '#ffffff', marginTop: 12, letterSpacing: 1 },
  emptySubtitle: { fontSize: 12, color: '#64748b', textAlign: 'center', marginTop: 6 },
  retryBtn: {
    backgroundColor: 'rgba(0, 255, 135, 0.12)',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#00ff87',
    marginTop: 16,
  },
  retryBtnText: { color: '#00ff87', fontWeight: '800', fontSize: 12 },
});