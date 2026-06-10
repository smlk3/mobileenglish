/**
 * apiKeyStore — secure storage for the user's AI provider API keys.
 *
 * Keys live in the device secure storage (Android Keystore via expo-secure-store;
 * AsyncStorage fallback on web), NOT in the SQLite database, so they are excluded
 * from device backups and any future DB sync.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export interface CustomEndpoint {
    apiKey: string;
    baseUrl: string;
    model: string;
}

export interface ApiKeys {
    activeProvider?: 'openai' | 'gemini' | 'custom';
    openai?: string;
    gemini?: string;
    custom?: CustomEndpoint;
}

const STORAGE_KEY = 'lingualearn.api_keys';
const isWeb = Platform.OS === 'web';

export async function getApiKeys(): Promise<ApiKeys> {
    try {
        const raw = isWeb
            ? await AsyncStorage.getItem(STORAGE_KEY)
            : await SecureStore.getItemAsync(STORAGE_KEY);
        return raw ? (JSON.parse(raw) as ApiKeys) : {};
    } catch {
        return {};
    }
}

/** Full replace — callers pass the complete desired state. */
export async function setApiKeys(keys: ApiKeys): Promise<void> {
    const raw = JSON.stringify(keys);
    if (isWeb) {
        await AsyncStorage.setItem(STORAGE_KEY, raw);
    } else {
        await SecureStore.setItemAsync(STORAGE_KEY, raw);
    }
}

export function hasAnyKey(keys: ApiKeys): boolean {
    return Boolean(keys.openai || keys.gemini || keys.custom?.apiKey);
}
