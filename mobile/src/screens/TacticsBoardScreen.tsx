import React, { useEffect, useState, useCallback } from 'react';
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

// Configuraciones de Formaciones Tácticas con coordenadas relativas (0 a 1)
const FORMATIONS: Record<string, { label: string; coords: { x: number; y: number; pos: string }[] }> = {
  '4-3-3': {
    label: '4-3-3 (Ofensiva)',
    coords: [
      { x: 0.50, y: 0.90, pos: 'GK' },
      { x: 0.15, y: 0.72, pos: 'LB' },
      { x: 0.38, y: 0.76, pos: 'CB' },
      { x: 0.62, y: 0.76, pos: 'CB' },
      { x: 0.85, y: 0.72, pos: 'RB' },
      { x: 0.50, y: 0.56, pos: 'CDM' },
      { x: 0.28, y: 0.44, pos: 'CM' },
      { x: 0.72, y: 0.44, pos: 'CM' },
      { x: 0.16, y: 0.22, pos: 'LW' },
      { x: 0.50, y: 0.16, pos: 'ST' },
      { x: 0.84, y: 0.22, pos: 'RW' },
    ],
  },
  '4-4-2': {
    label: '4-4-2 (Clásica)',
    coords: [
      { x: 0.50, y: 0.90, pos: 'GK' },
      { x: 0.15, y: 0.72, pos: 'LB' },
      { x: 0.38, y: 0.76, pos: 'CB' },
      { x: 0.62, y: 0.76, pos: 'CB' },
      { x: 0.85, y: 0.72, pos: 'RB' },
      { x: 0.14, y: 0.48, pos: 'LM' },
      { x: 0.38, y: 0.50, pos: 'CM' },
      { x: 0.62, y: 0.50, pos: 'CM' },
      { x: 0.86, y: 0.48, pos: 'RM' },
      { x: 0.36, y: 0.20, pos: 'ST' },
      { x: 0.64, y: 0.20, pos: 'ST' },
    ],
  },
  '3-5-2': {
    label: '3-5-2 (Dominio Medio)',
    coords: [
      { x: 0.50, y: 0.90, pos: 'GK' },
      { x: 0.25, y: 0.76, pos: 'CB' },
      { x: 0.50, y: 0.78, pos: 'CB' },
      { x: 0.75, y: 0.76, pos: 'CB' },
      { x: 0.10, y: 0.50, pos: 'LWB' },
      { x: 0.36, y: 0.54, pos: 'CDM' },
      { x: 0.64, y: 0.54, pos: 'CDM' },
      { x: 0.90, y: 0.50, pos: 'RWB' },
      { x: 0.50, y: 0.38, pos: 'CAM' },
      { x: 0.36, y: 0.18, pos: 'ST' },
      { x: 0.64, y: 0.18, pos: 'ST' },
    ],
  },
};

export const TacticsBoardScreen: React.FC = () => {
  const { user, profile } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedFormation, setSelectedFormation] = useState<string>('4-3-3');

  // Mapa de posiciones absolutas: { [playerId]: { x, y, pos } }
  const [playerPositions, setPlayerPositions] = useState<
    Record<string, { x: number; y: number; pos: string }>
  >({});

  // Bounding Box para no salir de la cancha
  const bounds: TokenBounds = {
    minX: 12,
    maxX: PITCH_WIDTH - 58,
    minY: 12,
    maxY: PITCH_HEIGHT - 62,
  };

  /**
   * 1. Cargar jugadores del club y táctica previa guardada en Supabase
   */
  const loadTacticsData = useCallback(async () => {
    setLoading(true);
    try {
      const clubId = profile?.assigned_club_id;
      if (!clubId) {
        setLoading(false);
        return;
      }

      // 1. Cargar plantilla de jugadores
      const { data: playersData } = await supabase
        .from('players')
        .select('*')
        .eq('club_id', clubId)
        .order('rating', { ascending: false })
        .limit(11);

      const teamPlayers = (playersData as Player[]) || [];
      setPlayers(teamPlayers);

      // 2. Cargar táctica guardada previamente
      const { data: savedTactic } = await supabase
        .from('tactics')
        .select('*')
        .eq('user_id', user?.id)
        .eq('club_id', clubId)
        .maybeSingle();

      if (savedTactic && savedTactic.positions && savedTactic.positions.length > 0) {
        setSelectedFormation(savedTactic.formation || '4-3-3');
        const posMap: Record<string, { x: number; y: number; pos: string }> = {};

        savedTactic.positions.forEach((p: any) => {
          posMap[p.player_id] = {
            x: p.x * PITCH_WIDTH,
            y: p.y * PITCH_HEIGHT,
            pos: p.position_label,
          };
        });

        setPlayerPositions(posMap);
      } else {
        // Asignación por defecto según formación 4-3-3
        applyFormation('4-3-3', teamPlayers);
      }
    } catch (err) {
      console.error('Error loading tactics:', err);
    } finally {
      setLoading(false);
    }
  }, [profile?.assigned_club_id, user?.id]);

  useEffect(() => {
    loadTacticsData();
  }, [loadTacticsData]);

  /**
   * Aplicar una formación táctica predefinida
   */
  const applyFormation = (formationKey: string, currentPlayers = players) => {
    setSelectedFormation(formationKey);
    const formConfig = FORMATIONS[formationKey];
    if (!formConfig || currentPlayers.length === 0) return;

    const newMap: Record<string, { x: number; y: number; pos: string }> = {};

    currentPlayers.forEach((player, index) => {
      const coord = formConfig.coords[index] || { x: 0.5, y: 0.5, pos: player.position };
      newMap[player.id] = {
        x: Math.min(Math.max(coord.x * PITCH_WIDTH - 23, bounds.minX), bounds.maxX),
        y: Math.min(Math.max(coord.y * PITCH_HEIGHT - 23, bounds.minY), bounds.maxY),
        pos: coord.pos,
      };
    });

    setPlayerPositions(newMap);
  };

  /**
   * Callback invocado al soltar una ficha con Drag & Drop
   */
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

  /**
   * Persistir en Supabase (public.tactics)
   */
  const handleSaveTactics = async () => {
    if (!user?.id || !profile?.assigned_club_id) return;

    setSaving(true);
    try {
      // Normalizar coordenadas a rango [0, 1] para independencia de resolución de pantalla
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
        Alert.alert('¡Táctica Guardada!', 'Tu formación y coordenadas han sido persistidas en Supabase.');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
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

          {/* Selector de Formaciones Clásicas */}
          <View style={styles.formationsBar}>
            {Object.keys(FORMATIONS).map((formKey) => {
              const isSelected = selectedFormation === formKey;
              return (
                <TouchableOpacity
                  key={formKey}
                  style={[styles.formationChip, isSelected && styles.formationChipSelected]}
                  onPress={() => applyFormation(formKey)}
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

          {/* CONTENEDOR DEL CAMPO DE FÚTBOL CON CANVAS Y FICHAS ARRASTRABLES */}
          <View style={[styles.pitchWrapper, { width: PITCH_WIDTH, height: PITCH_HEIGHT }]}>
            {/* 1. Lienzo Skia 2D (Fondo del campo) */}
            <PitchCanvas width={PITCH_WIDTH} height={PITCH_HEIGHT} />

            {/* 2. Capa de Fichas con Drag & Drop Absoluto (Reanimated 3 + Gesture Handler) */}
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
                  bounds={bounds}
                  onPositionChange={handlePositionChange}
                />
              );
            })}
          </View>

          {/* Instrucciones de Uso */}
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
    paddingBottom: 30,
    alignItems: 'center',
  },
  header: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 1.5,
  },
  subtitle: {
    fontSize: 9,
    fontWeight: '700',
    color: '#00ff87',
    letterSpacing: 1.5,
    marginTop: 2,
  },
  saveBtn: {
    backgroundColor: '#00ff87',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    gap: 6,
  },
  saveBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#070a0f',
  },
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
  formationChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94a3b8',
  },
  formationChipTextSelected: {
    color: '#00ff87',
    fontWeight: '900',
  },
  pitchWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
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
  tipsText: {
    flex: 1,
    fontSize: 11,
    color: '#94a3b8',
    lineHeight: 16,
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
});
