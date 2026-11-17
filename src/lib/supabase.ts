import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

export const SUPABASE_PROJECT_ID = 'ypbqpjcskybkzzhhehme';
export const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ??
  `https://${SUPABASE_PROJECT_ID}.supabase.co`;
export const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? 'votre-cle-publique-anon';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: Platform.OS === 'web' ? undefined : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
});
