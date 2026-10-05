import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import { LeaderboardItem } from '../types/database';

export const LeaderboardScreen: React.FC = () => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // 1. Obtener los datos dinámicos desde la vista o cálculo de PostgreSQL
  const fetchLeaderboard = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('leaderboard_view')
        .select('*')
        .order('pts', { ascending: false })
        .order('dg', { ascending: false })
        .order('gf', { ascending: false });

      if (error) {
        console.warn('Error fetching leaderboard_view:', error.message);
        // Fallback: calcular dinámicamente desde matches si la vista no tiene datos aún
        await fetchAndComputeFallbackLeaderboard();
      } else if (data) {
        setLeaderboard(data as LeaderboardItem[]);
      }
    } catch (err) {
      console.error('Unexpected error fetching leaderboard:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Cálculo en memoria en cliente para redundancia técnica garantizada
  const fetchAndComputeFallbackLeaderboard = async () => {
    try {
      const { data: participants } = await supabase
        .from('tournament_participants')
        .select('user_id, club_id, profiles(username), clubs(name, short_name, logo_url)');

      const { data: matches } = await supabase
        .from('matches')
        .select('*')
        .eq('status', 'finished');

      if (!participants) return;

      const statsMap: Record<string, LeaderboardItem> = {};

      participants.forEach((p: any) => {
        statsMap[p.user_id] = {
          tournament_id: p.tournament_id || '',
          user_id: p.user_id,
          username: p.profiles?.username || 'Gamer',
          club_id: p.club_id,
          club_name: p.clubs?.name || 'Club',
          club_short_name: p.clubs?.short_name || 'CLB',
          club_logo_url: p.clubs?.logo_url,
          pj: 0,
          pg: 0,
          pe: 0,
          pp: 0,
          gf: 0,
          gc: 0,
          dg: 0,
          pts: 0,
        };
      });

      if (matches) {
        matches.forEach((m) => {
          const home = statsMap[m.home_user_id];
          const away = statsMap[m.away_user_id];

          if (home && away) {
            home.pj += 1;
            away.pj += 1;
            home.gf += m.home_score;
            home.gc += m.away_score;
            away.gf += m.away_score;
            away.gc += m.home_score;

            if (m.home_score > m.away_score) {
              home.pg += 1;
              home.pts += 3;
              away.pp += 1;
            } else if (m.home_score === m.away_score) {
              home.pe += 1;
              home.pts += 1;
              away.pe += 1;
              away.pts += 1;
            } else {
              away.pg += 1;
              away.pts += 3;
              home.pp += 1;
            }
          }
        });
      }

      const list = Object.values(statsMap).map((item) => ({
        ...item,
        dg: item.gf - item.gc,
      }));

      list.sort((a, b) => {
        if (b.pts !== a.pts) return b.pts - a.pts;
        if (b.dg !== a.dg) return b.dg - a.dg;
        if (b.gf !== a.gf) return b.gf - a.gf;
        return a.club_name.localeCompare(b.club_name);
      });

      setLeaderboard(list);
    } catch (e) {
      console.error('Fallback compute error:', e);
    }
  };

  useEffect(() => {
    fetchLeaderboard();

    // 2. Suscripción en Tiempo Real con WebSockets a la tabla 'matches'
    // Cada vez que un partido finaliza o actualiza goles, la tabla se recalcula instantáneamente
    const matchChannel = supabase
      .channel('public:matches:leaderboard')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches' },
        () => {
          fetchLeaderboard();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(matchChannel);
    };
  }, [fetchLeaderboard]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchLeaderboard();
  };

  const renderHeader = () => (
    <View style={styles.tableHeaderRow}>
      <Text style={[styles.headerCell, styles.posCol]}>#</Text>
      <Text style={[styles.headerCell, styles.clubCol]}>CLUB / USUARIO</Text>
      <Text style={[styles.headerCell, styles.numCol]}>PJ</Text>
      <Text style={[styles.headerCell, styles.numCol]}>PG</Text>
      <Text style={[styles.headerCell, styles.numCol]}>PE</Text>
      <Text style={[styles.headerCell, styles.numCol]}>PP</Text>
      <Text style={[styles.headerCell, styles.numCol]}>GF</Text>
      <Text style={[styles.headerCell, styles.numCol]}>GC</Text>
      <Text style={[styles.headerCell, styles.numCol]}>DG</Text>
      <Text style={[styles.headerCell, styles.ptsCol]}>PTS</Text>
    </View>
  );

  const renderRow = ({ item, index }: { item: LeaderboardItem; index: number }) => {
    const isTopZone = index < 2; // Zona Champions League (Top 2)

    return (
      <View style={[styles.tableRow, isTopZone && styles.topZoneRow]}>
        {/* Posición */}
        <View style={styles.posCol}>
          <Text style={[styles.posText, isTopZone && styles.topZoneText]}>
            {index + 1}
          </Text>
        </View>

        {/* Club & Usuario */}
        <View style={[styles.clubCol, styles.clubInfoContainer]}>
          {item.club_logo_url ? (
            <Image
              source={{ uri: item.club_logo_url }}
              style={styles.tableClubLogo}
              resizeMode="contain"
            />
          ) : (
            <Ionicons name="shield-outline" size={20} color="#7e8b9b" />
          )}
          <View style={styles.nameBlock}>
            <Text style={styles.clubNameText} numberOfLines={1}>
              {item.club_name}
            </Text>
            <Text style={styles.userNameText} numberOfLines={1}>
              @{item.username}
            </Text>
          </View>
        </View>

        {/* Estadísticas */}
        <Text style={[styles.rowCell, styles.numCol]}>{item.pj}</Text>
        <Text style={[styles.rowCell, styles.numCol]}>{item.pg}</Text>
        <Text style={[styles.rowCell, styles.numCol]}>{item.pe}</Text>
        <Text style={[styles.rowCell, styles.numCol]}>{item.pp}</Text>
        <Text style={[styles.rowCell, styles.numCol]}>{item.gf}</Text>
        <Text style={[styles.rowCell, styles.numCol]}>{item.gc}</Text>
        <Text
          style={[
            styles.rowCell,
            styles.numCol,
            item.dg > 0 ? styles.positiveDg : item.dg < 0 ? styles.negativeDg : null,
          ]}
        >
          {item.dg > 0 ? `+${item.dg}` : item.dg}
        </Text>
        <Text style={[styles.rowCell, styles.ptsCol, styles.ptsText]}>{item.pts}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient
        colors={['#070a0f', '#0c1322', '#071526']}
        style={styles.gradientBackground}
      >
        {/* Título y badge en tiempo real */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>TABLA DE POSICIONES</Text>
            <Text style={styles.subtitle}>LIGA OFICIAL EA SPORTS FC</Text>
          </View>
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>REALTIME</Text>
          </View>
        </View>

        {/* Reglas de Puntuación */}
        <View style={styles.rulesBar}>
          <Text style={styles.rulesText}>
            Victoria = 3 pts  •  Empate = 1 pt  •  Derrota = 0 pts
          </Text>
        </View>

        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#00ff87" />
            <Text style={styles.loadingText}>Calculando posiciones dinámicas...</Text>
          </View>
        ) : leaderboard.length === 0 ? (
          <View style={styles.centerContainer}>
            <Ionicons name="trophy-outline" size={48} color="#64748b" />
            <Text style={styles.emptyText}>Aún no hay participantes en el torneo.</Text>
            <Text style={styles.emptySubtext}>
              Los participantes aparecerán aquí una vez registrados y habilitado el calendario.
            </Text>
          </View>
        ) : (
          <View style={styles.tableCard}>
            {renderHeader()}
            <FlatList
              data={leaderboard}
              keyExtractor={(item) => item.user_id}
              renderItem={renderRow}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor="#00ff87"
                />
              }
              contentContainerStyle={{ paddingBottom: 20 }}
            />
          </View>
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
  gradientBackground: {
    flex: 1,
    paddingTop: 45,
    paddingHorizontal: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 1.5,
  },
  subtitle: {
    fontSize: 11,
    color: '#00ff87',
    fontWeight: '700',
    letterSpacing: 2,
    marginTop: 2,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 255, 135, 0.1)',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 135, 0.3)',
    gap: 6,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#00ff87',
  },
  liveText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#00ff87',
    letterSpacing: 1,
  },
  rulesBar: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  rulesText: {
    fontSize: 11,
    color: '#94a3b8',
    textAlign: 'center',
  },
  tableCard: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#070a0f',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
  },
  headerCell: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748b',
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
    alignItems: 'center',
  },
  topZoneRow: {
    backgroundColor: 'rgba(0, 255, 135, 0.03)',
  },
  posCol: {
    width: 24,
    alignItems: 'center',
  },
  posText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94a3b8',
  },
  topZoneText: {
    color: '#00ff87',
    fontWeight: '900',
  },
  clubCol: {
    flex: 1,
    paddingHorizontal: 6,
  },
  clubInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tableClubLogo: {
    width: 22,
    height: 22,
  },
  nameBlock: {
    flex: 1,
  },
  clubNameText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  userNameText: {
    fontSize: 10,
    color: '#64748b',
  },
  numCol: {
    width: 24,
    textAlign: 'center',
  },
  ptsCol: {
    width: 32,
    textAlign: 'center',
  },
  rowCell: {
    fontSize: 12,
    color: '#cbd5e1',
  },
  positiveDg: {
    color: '#00ff87',
  },
  negativeDg: {
    color: '#f87171',
  },
  ptsText: {
    fontWeight: '900',
    color: '#00ff87',
    fontSize: 13,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    color: '#00ff87',
    marginTop: 12,
    fontSize: 13,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 6,
  },
});
