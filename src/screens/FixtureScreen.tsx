import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { Round, Match } from '../types/database';

export const FixtureScreen: React.FC<{ onSelectMatch?: (match: Match) => void }> = ({
  onSelectMatch,
}) => {
  const { user } = useAuth();
  const [rounds, setRounds] = useState<Round[]>([]);
  const [selectedRound, setSelectedRound] = useState<Round | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // 1. Cargar las jornadas del torneo
  const loadRounds = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('rounds')
        .select('*')
        .order('round_number', { ascending: true });

      if (data && data.length > 0) {
        setRounds(data as Round[]);
        // Por defecto seleccionar la primera fecha activa, o la fecha 1
        const active = data.find((r) => r.is_active) || data[0];
        setSelectedRound(active as Round);
      }
    } catch (e) {
      console.error('Error loading rounds:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // 2. Cargar partidos de la jornada seleccionada
  const loadMatchesForRound = useCallback(async (roundId: string) => {
    try {
      const { data, error } = await supabase
        .from('matches')
        .select('*, home_user:home_user_id(*), away_user:away_user_id(*), home_club:home_club_id(*), away_club:away_club_id(*)')
        .eq('round_id', roundId)
        .order('created_at', { ascending: true });

      if (data) {
        setMatches(data as Match[]);
      }
    } catch (e) {
      console.error('Error loading matches:', e);
    }
  }, []);

  useEffect(() => {
    loadRounds();
  }, [loadRounds]);

  useEffect(() => {
    if (selectedRound?.id) {
      loadMatchesForRound(selectedRound.id);
    }
  }, [selectedRound, loadMatchesForRound]);

  // Suscripción Realtime a cambios en partidos
  useEffect(() => {
    const channel = supabase
      .channel('public:matches:fixture')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches' },
        () => {
          if (selectedRound?.id) {
            loadMatchesForRound(selectedRound.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedRound, loadMatchesForRound]);

  const onRefresh = () => {
    setRefreshing(true);
    loadRounds();
    if (selectedRound?.id) {
      loadMatchesForRound(selectedRound.id);
    }
  };

  const getStatusBadge = (status: Match['status']) => {
    switch (status) {
      case 'live':
        return { label: 'EN VIVO', bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' };
      case 'pending_approval':
        return { label: 'HANDSHAKE', bg: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' };
      case 'disputed':
        return { label: 'DISPUTA', bg: 'rgba(239, 68, 68, 0.2)', color: '#f87171' };
      case 'finished':
        return { label: 'FINALIZADO', bg: 'rgba(0, 255, 135, 0.15)', color: '#00ff87' };
      default:
        return { label: 'PROGRAMADO', bg: 'rgba(148, 163, 184, 0.1)', color: '#94a3b8' };
    }
  };

  const renderMatch = ({ item }: { item: Match }) => {
    const isUserMatch = item.home_user_id === user?.id || item.away_user_id === user?.id;
    const badge = getStatusBadge(item.status);
    const canPlay = selectedRound?.is_active && (item.status === 'scheduled' || item.status === 'live');

    return (
      <TouchableOpacity
        style={[styles.matchCard, isUserMatch && styles.userMatchCard]}
        onPress={() => onSelectMatch && onSelectMatch(item)}
        activeOpacity={0.8}
      >
        <View style={styles.matchTopBar}>
          <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
            <Text style={[styles.statusText, { color: badge.color }]}>{badge.label}</Text>
          </View>
          {isUserMatch && (
            <View style={styles.myMatchTag}>
              <Ionicons name="person" size={12} color="#00ff87" />
              <Text style={styles.myMatchText}>TU PARTIDO</Text>
            </View>
          )}
        </View>

        <View style={styles.teamsRow}>
          {/* Local */}
          <View style={styles.teamCol}>
            {item.home_club?.logo_url ? (
              <Image source={{ uri: item.home_club.logo_url }} style={styles.teamLogo} resizeMode="contain" />
            ) : (
              <Ionicons name="shield" size={32} color="#94a3b8" />
            )}
            <Text style={styles.teamName} numberOfLines={1}>
              {item.home_club?.name || 'Local'}
            </Text>
            <Text style={styles.gamerTag}>@{item.home_user?.username}</Text>
          </View>

          {/* Marcador */}
          <View style={styles.scoreContainer}>
            <Text style={styles.scoreText}>
              {item.status === 'scheduled' ? 'VS' : `${item.home_score} - ${item.away_score}`}
            </Text>
            {canPlay && isUserMatch && (
              <View style={styles.enterMatchBadge}>
                <Text style={styles.enterMatchText}>JUGAR AHORA</Text>
              </View>
            )}
          </View>

          {/* Visitante */}
          <View style={styles.teamCol}>
            {item.away_club?.logo_url ? (
              <Image source={{ uri: item.away_club.logo_url }} style={styles.teamLogo} resizeMode="contain" />
            ) : (
              <Ionicons name="shield" size={32} color="#94a3b8" />
            )}
            <Text style={styles.teamName} numberOfLines={1}>
              {item.away_club?.name || 'Visitante'}
            </Text>
            <Text style={styles.gamerTag}>@{item.away_user?.username}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient colors={['#070a0f', '#0d1524', '#061322']} style={styles.gradient}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>CALENDARIO DE PARTIDOS</Text>
          <Text style={styles.subtitle}>MODALIDAD TODOS CONTRA TODOS (IDA Y VUELTA)</Text>
        </View>

        {/* Carrusel horizontal de Jornadas */}
        {rounds.length > 0 && (
          <View style={styles.roundsCarousel}>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={rounds}
              keyExtractor={(r) => r.id}
              renderItem={({ item }) => {
                const isSelected = selectedRound?.id === item.id;
                return (
                  <TouchableOpacity
                    style={[styles.roundTab, isSelected && styles.roundTabSelected]}
                    onPress={() => setSelectedRound(item)}
                  >
                    <Text style={[styles.roundTabText, isSelected && styles.roundTabTextSelected]}>
                      F{item.round_number}
                    </Text>
                    {item.is_active && <View style={styles.activeDot} />}
                  </TouchableOpacity>
                );
              }}
              contentContainerStyle={{ paddingHorizontal: 16 }}
            />
          </View>
        )}

        {/* Estado de la Jornada Actual */}
        {selectedRound && (
          <View style={styles.roundInfoBanner}>
            <Text style={styles.roundBannerName}>{selectedRound.name.toUpperCase()}</Text>
            <View
              style={[
                styles.roundBadge,
                selectedRound.is_active ? styles.roundActiveBadge : styles.roundInactiveBadge,
              ]}
            >
              <Text
                style={[
                  styles.roundBadgeText,
                  selectedRound.is_active ? styles.roundActiveText : styles.roundInactiveText,
                ]}
              >
                {selectedRound.is_active ? 'FECHA HABILITADA POR ADMIN' : 'FECHA EN ESPERA'}
              </Text>
            </View>
          </View>
        )}

        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#00ff87" />
          </View>
        ) : matches.length === 0 ? (
          <View style={styles.centerContainer}>
            <Ionicons name="calendar-outline" size={48} color="#64748b" />
            <Text style={styles.emptyText}>No hay partidos programados para esta fecha.</Text>
          </View>
        ) : (
          <FlatList
            data={matches}
            keyExtractor={(m) => m.id}
            renderItem={renderMatch}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00ff87" />}
            contentContainerStyle={styles.matchesList}
          />
        )}
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
  header: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 1.5,
  },
  subtitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#00ff87',
    letterSpacing: 1.5,
    marginTop: 2,
  },
  roundsCarousel: {
    marginVertical: 10,
  },
  roundTab: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  roundTabSelected: {
    borderColor: '#00ff87',
    backgroundColor: 'rgba(0, 255, 135, 0.1)',
  },
  roundTabText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94a3b8',
  },
  roundTabTextSelected: {
    color: '#00ff87',
    fontWeight: '900',
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00ff87',
    marginLeft: 6,
  },
  roundInfoBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginVertical: 8,
  },
  roundBannerName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
  },
  roundBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  roundActiveBadge: {
    backgroundColor: 'rgba(0, 255, 135, 0.15)',
  },
  roundInactiveBadge: {
    backgroundColor: 'rgba(148, 163, 184, 0.1)',
  },
  roundBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  roundActiveText: {
    color: '#00ff87',
  },
  roundInactiveText: {
    color: '#94a3b8',
  },
  matchesList: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  matchCard: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 16,
    marginBottom: 12,
  },
  userMatchCard: {
    borderColor: 'rgba(0, 255, 135, 0.4)',
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
  },
  matchTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 9,
    fontWeight: '800',
  },
  myMatchTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  myMatchText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#00ff87',
  },
  teamsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  teamCol: {
    flex: 1,
    alignItems: 'center',
  },
  teamLogo: {
    width: 44,
    height: 44,
    marginBottom: 6,
  },
  teamName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
    textAlign: 'center',
  },
  gamerTag: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
  },
  scoreContainer: {
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  scoreText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 2,
  },
  enterMatchBadge: {
    backgroundColor: '#00ff87',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginTop: 6,
  },
  enterMatchText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#070a0f',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#94a3b8',
    marginTop: 10,
    fontSize: 13,
  },
});
