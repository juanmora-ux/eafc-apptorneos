import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';

export const AuthScreen: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Validación y Login
  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Campos requeridos', 'Por favor ingresa tu correo y contraseña.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      });

      if (error) {
        Alert.alert('Error de Inicio de Sesión', error.message);
      }
    } catch (err: any) {
      Alert.alert('Error inesperado', err.message || 'Ocurrió un error al conectar.');
    } finally {
      setLoading(false);
    }
  };

  // Validación y Registro
  const handleSignUp = async () => {
    if (!email.trim() || !password.trim() || !username.trim()) {
      Alert.alert('Campos requeridos', 'Por favor completa todos los campos.');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Contraseña débil', 'La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setLoading(true);
    try {
      // Registramos en Supabase Auth enviando el 'username' en la metadata
      // El trigger en PostgreSQL 'handle_new_user' se encargará de crear el registro en public.profiles
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password,
        options: {
          data: {
            username: username.trim(),
          },
        },
      });

      if (error) {
        Alert.alert('Error de Registro', error.message);
      } else if (data.user && !data.session) {
        // En caso de que la confirmación por email esté activada en Supabase
        Alert.alert(
          'Registro Exitoso',
          'Revisa tu correo para confirmar tu cuenta antes de iniciar sesión.'
        );
        setIsLogin(true);
      }
    } catch (err: any) {
      Alert.alert('Error inesperado', err.message || 'Ocurrió un error en el registro.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <StatusBar style="light" />
      <LinearGradient
        colors={['#070a0f', '#0d131f', '#0a1d2e']}
        style={styles.gradientBackground}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header & Logo EA FC */}
          <View style={styles.headerContainer}>
            <View style={styles.logoBadge}>
              <Ionicons name="football" size={42} color="#00ff87" />
            </View>
            <Text style={styles.appTitle}>EA SPORTS FC</Text>
            <Text style={styles.appSubtitle}>COMPANION APP & TOURNAMENT</Text>
          </View>

          {/* Card Principal */}
          <View style={styles.cardContainer}>
            {/* Tabs Selector: Iniciar Sesión / Registrarse */}
            <View style={styles.tabBar}>
              <TouchableOpacity
                style={[styles.tabButton, isLogin && styles.tabButtonActive]}
                onPress={() => setIsLogin(true)}
                activeOpacity={0.8}
              >
                <Text style={[styles.tabText, isLogin && styles.tabTextActive]}>
                  Iniciar Sesión
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabButton, !isLogin && styles.tabButtonActive]}
                onPress={() => setIsLogin(false)}
                activeOpacity={0.8}
              >
                <Text style={[styles.tabText, !isLogin && styles.tabTextActive]}>
                  Registrarse
                </Text>
              </TouchableOpacity>
            </View>

            {/* Formulario */}
            <View style={styles.formContent}>
              {!isLogin && (
                <View style={styles.inputWrapper}>
                  <Text style={styles.inputLabel}>NOMBRE DE USUARIO / GAMERTAG</Text>
                  <View style={styles.inputBox}>
                    <Ionicons name="person-outline" size={20} color="#7e8b9b" style={styles.inputIcon} />
                    <TextInput
                      style={styles.textInput}
                      placeholder="Ej: StrikerPro99"
                      placeholderTextColor="#556271"
                      value={username}
                      onChangeText={setUsername}
                      autoCapitalize="none"
                    />
                  </View>
                </View>
              )}

              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>CORREO ELECTRÓNICO</Text>
                <View style={styles.inputBox}>
                  <Ionicons name="mail-outline" size={20} color="#7e8b9b" style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="usuario@ejemplo.com"
                    placeholderTextColor="#556271"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
              </View>

              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>CONTRASEÑA</Text>
                <View style={styles.inputBox}>
                  <Ionicons name="lock-closed-outline" size={20} color="#7e8b9b" style={styles.inputIcon} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="Mínimo 6 caracteres"
                    placeholderTextColor="#556271"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeIcon}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color="#7e8b9b"
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Botón de Acción Principal */}
              <TouchableOpacity
                style={styles.actionButton}
                onPress={isLogin ? handleLogin : handleSignUp}
                disabled={loading}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={['#00ff87', '#60efff']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.gradientButton}
                >
                  {loading ? (
                    <ActivityIndicator color="#070a0f" size="small" />
                  ) : (
                    <Text style={styles.actionButtonText}>
                      {isLogin ? 'ENTRAR A LA CANCHA' : 'CREAR JUGADOR'}
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>

          {/* Footer Informativo */}
          <View style={styles.footerNote}>
            <Ionicons name="shield-checkmark-outline" size={16} color="#00ff87" />
            <Text style={styles.footerText}>
              Infraestructura segura con Supabase Auth & PostgreSQL RLS
            </Text>
          </View>
        </ScrollView>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070a0f',
  },
  gradientBackground: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoBadge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0, 255, 135, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#00ff87',
    marginBottom: 16,
  },
  appTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 2,
  },
  appSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#00ff87',
    letterSpacing: 3,
    marginTop: 4,
  },
  cardContainer: {
    backgroundColor: 'rgba(21, 28, 41, 0.85)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 8,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
  },
  tabButtonActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#00ff87',
    backgroundColor: 'rgba(0, 255, 135, 0.05)',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#7e8b9b',
  },
  tabTextActive: {
    color: '#00ff87',
    fontWeight: '700',
  },
  formContent: {
    padding: 24,
  },
  inputWrapper: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#a0aec0',
    letterSpacing: 1,
    marginBottom: 8,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0c1017',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 14,
    height: 52,
  },
  inputIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 15,
  },
  eyeIcon: {
    padding: 6,
  },
  actionButton: {
    marginTop: 10,
    borderRadius: 12,
    overflow: 'hidden',
  },
  gradientButton: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#070a0f',
    letterSpacing: 1.5,
  },
  footerNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 28,
    gap: 8,
  },
  footerText: {
    fontSize: 11,
    color: '#7e8b9b',
  },
});
