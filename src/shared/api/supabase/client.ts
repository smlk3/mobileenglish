import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import 'react-native-url-polyfill/auto';

// SecureStore caps each value at ~2048 bytes. Supabase session tokens (especially
// with Google) can exceed that, which would break session persistence. On native we
// transparently split large values into chunks; on web we use AsyncStorage as-is.
const isWeb = Platform.OS === 'web';
const CHUNK_SIZE = 2000;

async function clearChunks(key: string): Promise<void> {
  const countRaw = await SecureStore.getItemAsync(`${key}.chunks`);
  if (countRaw == null) return;
  const count = parseInt(countRaw, 10) || 0;
  for (let i = 0; i < count; i++) {
    await SecureStore.deleteItemAsync(`${key}.${i}`);
  }
  await SecureStore.deleteItemAsync(`${key}.chunks`);
}

const ExpoSecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    if (isWeb) return AsyncStorage.getItem(key);
    const countRaw = await SecureStore.getItemAsync(`${key}.chunks`);
    if (countRaw == null) {
      // Not chunked — fall back to a legacy single-value entry if present.
      return SecureStore.getItemAsync(key);
    }
    const count = parseInt(countRaw, 10) || 0;
    let value = '';
    for (let i = 0; i < count; i++) {
      const part = await SecureStore.getItemAsync(`${key}.${i}`);
      if (part == null) return null;
      value += part;
    }
    return value;
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (isWeb) return AsyncStorage.setItem(key, value);
    await clearChunks(key);
    await SecureStore.deleteItemAsync(key); // drop any legacy single value
    const count = Math.ceil(value.length / CHUNK_SIZE) || 1;
    await SecureStore.setItemAsync(`${key}.chunks`, String(count));
    for (let i = 0; i < count; i++) {
      await SecureStore.setItemAsync(`${key}.${i}`, value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE));
    }
  },
  removeItem: async (key: string): Promise<void> => {
    if (isWeb) return AsyncStorage.removeItem(key);
    await clearChunks(key);
    await SecureStore.deleteItemAsync(key);
  },
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
