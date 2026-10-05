import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// ==============================================================================
// CONFIGURACIÓN DE SUPABASE PARA REACT NATIVE / EXPO GO
// Reemplaza con tus credenciales de Supabase (Project Settings -> API)
// ==============================================================================
export const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://izgbbjhiooiolayxdmrg.supabase.co';
export const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_O34to5iZA3QVR3snG2Bu-g_GqRkA_Xp';

/**
 * Cliente de Supabase adaptado para React Native.
 * - persistSession: true -> guarda los tokens de autenticación en AsyncStorage.
 * - detectSessionInUrl: false -> previene búsquedas de hash en la ventana de navegación (no soportado en nativo).
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
