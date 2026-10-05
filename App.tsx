import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { AuthScreen } from './src/screens/AuthScreen';
import { ClubWheelScreen } from './src/screens/ClubWheelScreen';
import { FixtureScreen } from './src/screens/FixtureScreen';
import { LeaderboardScreen } from './src/screens/LeaderboardScreen';
import { AdminPanelScreen } from './src/screens/AdminPanelScreen';
import { LiveMatchScreen } from './src/screens/LiveMatchScreen';
import { TacticsBoardScreen } from './src/screens/TacticsBoardScreen';
import { Match } from './src/types/database';

type TabType = 'club' | 'tactics' | 'fixture' | 'leaderboard' | 'admin';

const MainTabsNavigator: React.FC = () => {
  const { session, profile, isLoading } = useAuth();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TabType>('club');
  const [activeMatch, setActiveMatch] = useState<Match | null>(null);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00ff87" />
      </View>
    );
  }

  // 1. Si no hay sesión activa, muestra pantalla de autenticación
  if (!session) {
    return <AuthScreen />;
  }

  // 2. Si el usuario aún no gira la ruleta, forzar la pantalla de Ruleta de Asignación
  if (!profile?.has_spun_wheel) {
    return <ClubWheelScreen />;
  }

  // 3. Si el usuario entra a un partido activo en vivo -> Pantalla Horizontal Exclusiva
  if (activeMatch) {
    return (
      <LiveMatchScreen
        match={activeMatch}
        onExit={() => setActiveMatch(null)}
      />
    );
  }

  // 4. Renderizado de las pestañas principales en vertical
  const renderCurrentScreen = () => {
    switch (activeTab) {
      case 'club':
        return <ClubWheelScreen />;
      case 'tactics':
        return <TacticsBoardScreen />;
      case 'fixture':
        return <FixtureScreen onSelectMatch={(m) => setActiveMatch(m)} />;
      case 'leaderboard':
        return <LeaderboardScreen />;
      case 'admin':
        return <AdminPanelScreen />;
      default:
        return <ClubWheelScreen />;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.contentArea}>{renderCurrentScreen()}</View>

      {/* Barra de Navegación Inferior (Custom Tab Bar) */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab('club')}
          activeOpacity={0.8}
        >
          <Ionicons
            name={activeTab === 'club' ? 'shield' : 'shield-outline'}
            size={20}
            color={activeTab === 'club' ? '#00ff87' : '#64748b'}
          />
          <Text style={[styles.tabLabel, activeTab === 'club' && styles.tabLabelActive]}>
            Club
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab('tactics')}
          activeOpacity={0.8}
        >
          <Ionicons
            name={activeTab === 'tactics' ? 'clipboard' : 'clipboard-outline'}
            size={20}
            color={activeTab === 'tactics' ? '#00ff87' : '#64748b'}
          />
          <Text style={[styles.tabLabel, activeTab === 'tactics' && styles.tabLabelActive]}>
            Táctica
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab('fixture')}
          activeOpacity={0.8}
        >
          <Ionicons
            name={activeTab === 'fixture' ? 'calendar' : 'calendar-outline'}
            size={20}
            color={activeTab === 'fixture' ? '#00ff87' : '#64748b'}
          />
          <Text style={[styles.tabLabel, activeTab === 'fixture' && styles.tabLabelActive]}>
            Fixture
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab('leaderboard')}
          activeOpacity={0.8}
        >
          <Ionicons
            name={activeTab === 'leaderboard' ? 'trophy' : 'trophy-outline'}
            size={20}
            color={activeTab === 'leaderboard' ? '#00ff87' : '#64748b'}
          />
          <Text style={[styles.tabLabel, activeTab === 'leaderboard' && styles.tabLabelActive]}>
            Posiciones
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabItem}
          onPress={() => setActiveTab('admin')}
          activeOpacity={0.8}
        >
          <Ionicons
            name={activeTab === 'admin' ? 'settings' : 'settings-outline'}
            size={20}
            color={activeTab === 'admin' ? '#00ff87' : '#64748b'}
          />
          <Text style={[styles.tabLabel, activeTab === 'admin' && styles.tabLabelActive]}>
            Admin
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <MainTabsNavigator />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070a0f',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#070a0f',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentArea: {
    flex: 1,
  },
  bottomBar: {
    flexDirection: 'row',
    backgroundColor: '#0d131f',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    paddingTop: 6,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748b',
    marginTop: 3,
  },
  tabLabelActive: {
    color: '#00ff87',
  },
});
