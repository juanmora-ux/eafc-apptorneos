import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Dimensions,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import { Club } from '../types/database';

const { width } = Dimensions.get('window');
const WHEEL_SIZE = Math.min(width * 0.85, 340);
const RADIUS = WHEEL_SIZE / 2;

interface ClubWheelScreenProps {
  onNavigateToLeaderboard?: () => void;
}

export const ClubWheelScreen: React.FC<ClubWheelScreenProps> = ({ onNavigateToLeaderboard }) => {
  const { user, profile, refreshProfile, signOut } = useAuth();

  const [clubs, setClubs] = useState<Club[]>([]);
  const [assignedClub, setAssignedClub] = useState<Club | null>(null);
  const [loadingClubs, setLoadingClubs] = useState(true);
  const [isSpinning, setIsSpinning] = useState(false);
  const [winnerModalVisible, setWinnerModalVisible] = useState(false);
  const [selectedClub, setSelectedClub] = useState<Club | null>(null);

  const rotation = useSharedValue(0);

  useEffect(() => {
    fetchClubs();
  }, []);

  useEffect(() => {
    if (profile?.assigned_club_id && clubs.length > 0) {
      const found = clubs.find((c) => c.id === profile.assigned_club_id);
      if (found) {
        setAssignedClub(found);
      }
    }
  }, [profile, clubs]);

  const fetchClubs = async () => {
    try {
      const { data, error } = await supabase
        .from('clubs')
        .select('*, leagues(*)')
        .order('overall_rating', { ascending: false });

      if (error) {
        Alert.alert('Error al cargar clubes', error.message);
      } else if (data) {
        setClubs(data as Club[]);
      }
    } catch (err: any) {
      console.error('Error fetching clubs:', err);
    } finally {
      setLoadingClubs(false);
    }
  };

  /**
   * Redirección a la pantalla de Posiciones
   */
  const handleGoToLeaderboard = async () => {
    await refreshProfile();
    if (onNavigateToLeaderboard) {
      onNavigateToLeaderboard();
    }
  };

  const handleSpinEnd = async (winningClub: Club) => {
    setIsSpinning(false);
    setSelectedClub(winningClub);
    setAssignedClub(winningClub);
    setWinnerModalVisible(true);

    if (!user?.id) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          assigned_club_id: winningClub.id,
          has_spun_wheel: true,
        })
        .eq('id', user.id);

      if (error) {
        console.error('Error actualizando perfil con club asignado:', error.message);
        Alert.alert('Aviso', 'El club se seleccionó pero ocurrió un error al persistir.');
      } else {
        await refreshProfile();
      }
    } catch (err: any) {
      console.error('Excepción al persistir club asignado:', err);
    }
  };

  const spinWheel = () => {
    if (isSpinning || profile?.has_spun_wheel || clubs.length === 0) return;

    setIsSpinning(true);

    const randomIndex = Math.floor(Math.random() * clubs.length);
    const winningClub = clubs[randomIndex];

    const segmentAngle = 360 / clubs.length;
    const fullSpins = 6 * 360;
    const targetAngle = fullSpins + (clubs.length - randomIndex) * segmentAngle;

    rotation.value = 0;
    rotation.value = withTiming(
      targetAngle,
      {
        duration: 4500,
        easing: Easing.out(Easing.cubic),
      },
      (finished) => {
        if (finished) {
          runOnJS(handleSpinEnd)(winningClub);
        }
      }
    );
  };

  const animatedWheelStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${rotation.value}deg` }],
    };
  });

  if (loadingClubs) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00ff87" />
        <Text style={styles.loadingText}>Cargando clubes de Europa...</Text>
      </View>
    );
  }

  if (profile?.has_spun_wheel && assignedClub) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <LinearGradient
          colors={['#070a0f', '#0f172a', '#081e35']}
          style={styles.gradientBackground}
        >
          <View style={styles.headerBar}>
            <View>
              <Text style={styles.welcomeLabel}>BIENVENIDO,</Text>
              <Text style={styles.usernameLabel}>{profile.username.toUpperCase()}</Text>
            </View>
            <TouchableOpacity onPress={signOut} style={styles.logoutBtn}>
              <Ionicons name="log-out-outline" size={22} color="#e53e3e" />
            </TouchableOpacity>
          </View>

          <View style={styles.assignedContainer}>
            <View style={styles.badgePersistent}>
              <Ionicons name="checkmark-circle" size={16} color="#00ff87" />
              <Text style={styles.badgePersistentText}>CLUB ASIGNADO PARA EL TORNEO</Text>
            </View>

            <View style={styles.clubCard}>
              <LinearGradient
                colors={['#1e293b', '#0f172a']}
                style={styles.clubCardGradient}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.cardRating}>{assignedClub.overall_rating}</Text>
                  <Text style={styles.cardOvrLabel}>OVR</Text>
                </View>

                {assignedClub.logo_url ? (
                  <Image
                    source={{ uri: assignedClub.logo_url }}
                    style={styles.cardLogo}
                    resizeMode="contain"
                  />
                ) : (
                  <Ionicons name="shield" size={80} color="#00ff87" />
                )}

                <Text style={styles.cardClubName}>{assignedClub.name}</Text>
                <Text style={styles.cardLeagueName}>
                  {assignedClub.leagues?.name || 'Liga Europea'} • {assignedClub.short_name}
                </Text>

                <View style={styles.divider} />

                <Text style={styles.persistenceNote}>
                  Este es tu club oficial intransferible durante todo el campeonato.
                </Text>
              </LinearGradient>
            </View>

            <TouchableOpacity
              style={styles.readyButton}
              activeOpacity={0.85}
              onPress={handleGoToLeaderboard}
            >
              <LinearGradient
                colors={['#00ff87', '#60efff']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.readyButtonGradient}
              >
                <Text style={styles.readyButtonText}>IR A POSICIONES</Text>
                <Ionicons name="trophy-outline" size={18} color="#070a0f" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient
        colors={['#070a0f', '#0d131f', '#081726']}
        style={styles.gradientBackground}
      >
        <View style={styles.wheelHeader}>
          <Text style={styles.wheelTitle}>RULETA DE ASIGNACIÓN</Text>
          <Text style={styles.wheelSubtitle}>
            Gira para seleccionar al azar tu club oficial del torneo
          </Text>
        </View>

        <View style={styles.wheelWrapper}>
          <View style={styles.pointerContainer}>
            <View style={styles.pointerTriangle} />
          </View>

          <Animated.View style={[styles.wheelCircle, animatedWheelStyle]}>
            <View style={styles.wheelCenterRing}>
              <LinearGradient
                colors={['#00ff87', '#00b4d8']}
                style={styles.wheelCenterHub}
              >
                <Ionicons name="football" size={32} color="#070a0f" />
              </LinearGradient>
            </View>

            {clubs.slice(0, 12).map((club, index) => {
              const angle = (index * (360 / 12)) * (Math.PI / 180);
              const x = RADIUS + (RADIUS - 40) * Math.cos(angle) - 16;
              const y = RADIUS + (RADIUS - 40) * Math.sin(angle) - 16;

              return (
                <View
                  key={club.id}
                  style={[
                    styles.clubIconSegment,
                    { left: x, top: y },
                  ]}
                >
                  {club.logo_url ? (
                    <Image
                      source={{ uri: club.logo_url }}
                      style={styles.miniLogo}
                      resizeMode="contain"
                    />
                  ) : (
                    <Text style={styles.miniText}>{club.short_name}</Text>
                  )}
                </View>
              );
            })}
          </Animated.View>
        </View>

        <View style={styles.actionContainer}>
          <TouchableOpacity
            style={[styles.spinButton, isSpinning && styles.spinButtonDisabled]}
            onPress={spinWheel}
            disabled={isSpinning}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={isSpinning ? ['#4a5568', '#2d3748'] : ['#00ff87', '#00d2ff']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.spinButtonGradient}
            >
              {isSpinning ? (
                <View style={styles.spinningRow}>
                  <ActivityIndicator color="#ffffff" size="small" style={{ marginRight: 8 }} />
                  <Text style={styles.spinButtonText}>SELECCIONANDO CLUB...</Text>
                </View>
              ) : (
                <Text style={styles.spinButtonText}>GIRAR RULETA AHORA</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <Text style={styles.wheelInstruction}>
            * La asignación es única y se guardará permanentemente en tu perfil.
          </Text>
        </View>

        {winnerModalVisible && selectedClub && (
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Ionicons name="sparkles" size={32} color="#00ff87" />
              <Text style={styles.congratsText}>¡TU CLUB HA SIDO ASIGNADO!</Text>

              {selectedClub.logo_url && (
                <Image
                  source={{ uri: selectedClub.logo_url }}
                  style={styles.modalLogo}
                  resizeMode="contain"
                />
              )}

              <Text style={styles.modalClubName}>{selectedClub.name}</Text>
              <Text style={styles.modalClubLeague}>
                {selectedClub.leagues?.name || 'Liga de Europa'}
              </Text>

              <View style={styles.modalRatingBadge}>
                <Text style={styles.modalRatingText}>
                  VALORACIÓN GENERAL: {selectedClub.overall_rating} OVR
                </Text>
              </View>

              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={() => {
                  setWinnerModalVisible(false);
                  handleGoToLeaderboard();
                }}
              >
                <Text style={styles.modalConfirmBtnText}>IR A POSICIONES</Text>
              </TouchableOpacity>
            </View>
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
    paddingHorizontal: 20,
    paddingTop: 50,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#070a0f',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#00ff87',
    marginTop: 12,
    fontSize: 14,
    fontWeight: '600',
  },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  welcomeLabel: {
    fontSize: 11,
    color: '#7e8b9b',
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  usernameLabel: {
    fontSize: 20,
    color: '#ffffff',
    fontWeight: '900',
  },
  logoutBtn: {
    padding: 8,
    backgroundColor: 'rgba(229, 62, 62, 0.1)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(229, 62, 62, 0.3)',
  },
  wheelHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  wheelTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 2,
  },
  wheelSubtitle: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 20,
  },
  wheelWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
  },
  pointerContainer: {
    zIndex: 10,
    alignItems: 'center',
    marginBottom: -16,
  },
  pointerTriangle: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 14,
    borderRightWidth: 14,
    borderTopWidth: 26,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#00ff87',
    shadowColor: '#00ff87',
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 8,
  },
  wheelCircle: {
    width: WHEEL_SIZE,
    height: WHEEL_SIZE,
    borderRadius: RADIUS,
    backgroundColor: '#0f172a',
    borderWidth: 6,
    borderColor: '#1e293b',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#00ff87',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  wheelCenterRing: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#070a0f',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#334155',
    zIndex: 5,
  },
  wheelCenterHub: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clubIconSegment: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniLogo: {
    width: 24,
    height: 24,
  },
  miniText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#ffffff',
  },
  actionContainer: {
    marginTop: 24,
    alignItems: 'center',
  },
  spinButton: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
  },
  spinButtonDisabled: {
    opacity: 0.7,
  },
  spinButtonGradient: {
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinningRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  spinButtonText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#070a0f',
    letterSpacing: 1.5,
  },
  wheelInstruction: {
    fontSize: 11,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 12,
  },
  assignedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgePersistent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 255, 135, 0.1)',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 135, 0.3)',
    marginBottom: 20,
    gap: 6,
  },
  badgePersistentText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#00ff87',
    letterSpacing: 1,
  },
  clubCard: {
    width: width * 0.85,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(0, 255, 135, 0.3)',
    shadowColor: '#00ff87',
    shadowOpacity: 0.3,
    shadowRadius: 25,
    elevation: 12,
  },
  clubCardGradient: {
    padding: 28,
    alignItems: 'center',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    alignSelf: 'flex-start',
    gap: 4,
  },
  cardRating: {
    fontSize: 36,
    fontWeight: '900',
    color: '#ffffff',
  },
  cardOvrLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#00ff87',
  },
  cardLogo: {
    width: 120,
    height: 120,
    marginVertical: 16,
  },
  cardClubName: {
    fontSize: 22,
    fontWeight: '900',
    color: '#ffffff',
    textAlign: 'center',
  },
  cardLeagueName: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 4,
    fontWeight: '600',
  },
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginVertical: 18,
  },
  persistenceNote: {
    fontSize: 11,
    color: '#64748b',
    textAlign: 'center',
  },
  readyButton: {
    width: width * 0.85,
    marginTop: 24,
    borderRadius: 14,
    overflow: 'hidden',
  },
  readyButtonGradient: {
    flexDirection: 'row',
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  readyButtonText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#070a0f',
    letterSpacing: 1.5,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(7, 10, 15, 0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 100,
  },
  modalCard: {
    backgroundColor: '#0f172a',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#00ff87',
    padding: 28,
    alignItems: 'center',
    width: '100%',
  },
  congratsText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#00ff87',
    letterSpacing: 1,
    marginVertical: 12,
    textAlign: 'center',
  },
  modalLogo: {
    width: 100,
    height: 100,
    marginVertical: 12,
  },
  modalClubName: {
    fontSize: 24,
    fontWeight: '900',
    color: '#ffffff',
    textAlign: 'center',
  },
  modalClubLeague: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 2,
  },
  modalRatingBadge: {
    backgroundColor: 'rgba(0, 255, 135, 0.1)',
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 135, 0.3)',
    marginTop: 16,
  },
  modalRatingText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#00ff87',
  },
  modalConfirmBtn: {
    backgroundColor: '#00ff87',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    marginTop: 22,
    width: '100%',
    alignItems: 'center',
  },
  modalConfirmBtnText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#070a0f',
    letterSpacing: 1,
  },
});