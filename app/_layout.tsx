import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Animated, AppState, Image, StyleSheet, Text } from 'react-native';
import 'react-native-get-random-values';
import 'react-native-reanimated';
import '../src/shared/api/supabase/client'; // Supabase client and polyfills
import '../src/shared/i18n'; // i18n must be initialized before any screen renders
import i18n from '../src/shared/i18n';

SplashScreen.preventAutoHideAsync();

import { initializeDefaultSettings } from '../src/entities/database';
import HybridLLMManager from '../src/shared/api/llm/HybridLLMManager';
import { AuthService } from '../src/shared/api/supabase/AuthService';
import { syncDatabase } from '../src/shared/api/supabase/SyncService';
import { getUserSettings } from '../src/shared/lib/stores/useDatabaseService';
import { useProfileStore } from '../src/shared/lib/stores/useProfileStore';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const themeMode = useProfileStore((s) => s.themeMode);
  const onboardingCompleted = useProfileStore((s) => s.onboardingCompleted);
  const router = useRouter();
  const didInit = useRef(false);
  const [isReady, setIsReady] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!isReady) return;
    if (!onboardingCompleted) {
      setTimeout(() => router.replace('/onboarding' as any), 0);
    }
  }, [isReady, onboardingCompleted]);

  // Keep the store in sync with Supabase auth state changes, persist the linked
  // supabase_user_id to the DB, and run a sync when a session becomes available.
  useEffect(() => {
    const subscription = AuthService.onAuthStateChange(async (event, session) => {
      useProfileStore.getState().setSupabaseSession(session);
      try {
        const s = await getUserSettings();
        if (s) await s.updateSettings({ supabaseUserId: session?.user?.id ?? null });
      } catch (e) {
        console.warn('Failed to persist supabase_user_id:', e);
      }
      if (session && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
        syncDatabase().catch((e) => console.warn('Sync failed:', e));
      }
    });
    return () => subscription?.unsubscribe();
  }, []);

  // Sync when the app returns to the foreground (only while signed in).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && useProfileStore.getState().supabaseSession) {
        syncDatabase().catch((e) => console.warn('Sync failed:', e));
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;

    const init = async () => {
      await initializeDefaultSettings();

      // Load user settings and configure cloud if API key exists
      const llm = HybridLLMManager.getInstance();
      const settings = await getUserSettings();
      if (settings) {
        const tags = settings.profileTags;
        useProfileStore.getState().setProfile({
          profession: tags.profession,
          interests: tags.interests,
          level: tags.level,
          nativeLanguage: tags.nativeLanguage,
          goals: tags.goals,
        });

        // Target language from DB
        useProfileStore.getState().setTargetLanguage(settings.targetLanguage || 'en');

        // Sync UI language with saved native language
        const nativeLang = tags.nativeLanguage || settings.nativeLanguage || 'en';
        if (nativeLang && nativeLang !== i18n.language) {
          i18n.changeLanguage(nativeLang);
        }

        // Onboarding status
        useProfileStore.getState().setOnboardingCompleted(!!settings.onboardingCompleted);

        // Daily goal
        useProfileStore.getState().setDailyGoal(settings.dailyGoal || 20);

        // Theme from DB
        if (settings.theme === 'light') {
          useProfileStore.getState().setThemeMode('light');
        }

        // Configure cloud API if key exists (no validation on startup — keys were validated on entry)
        const keys = settings.apiKeys;
        if (keys.openai) {
          llm.configureCloud(keys.openai, 'openai');
          useProfileStore.getState().setCloudAvailable(true);
          useProfileStore.getState().setActiveModel('cloud');
        } else if (keys.gemini) {
          llm.configureCloud(keys.gemini, 'gemini');
          useProfileStore.getState().setCloudAvailable(true);
          useProfileStore.getState().setActiveModel('cloud');
        } else if (keys.custom) {
          llm.configureCloud(keys.custom.apiKey, 'custom', keys.custom.baseUrl, keys.custom.model);
          useProfileStore.getState().setCloudAvailable(true);
          useProfileStore.getState().setActiveModel('cloud');
        }

        if (!keys.openai && !keys.gemini && !keys.custom) {
          useProfileStore.getState().setActiveModel('none');
        }

      }

      // Restore Supabase session (null = guest mode)
      try {
        const session = await AuthService.getSession();
        useProfileStore.getState().setSupabaseSession(session);
      } catch (e) {
        console.warn('Supabase session restore failed:', e);
      }
    };

    const timeout = new Promise<void>((resolve) => setTimeout(resolve, 8000));
    Promise.race([init(), timeout])
      .catch(console.error)
      .finally(async () => {
        await SplashScreen.hideAsync();
        setTimeout(() => {
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }).start(() => setIsReady(true));
        }, 800);
      });
  }, [fadeAnim]);

  const navigationTheme = themeMode === 'dark'
    ? {
      ...DarkTheme,
      colors: {
        ...DarkTheme.colors,
        background: '#0F0F23',
        card: '#1A1A2E',
        primary: '#6366F1',
        text: '#EAEAFF',
        border: '#2A2A4A',
      },
    }
    : {
      ...DefaultTheme,
      colors: {
        ...DefaultTheme.colors,
        background: '#F8FAFC',
        card: '#FFFFFF',
        primary: '#6366F1',
        text: '#0F172A',
        border: '#E2E8F0',
      },
    };

  if (!isReady) {
    return (
      <Animated.View style={[splashStyles.container, { opacity: fadeAnim }]}>
        <Image
          source={require('../assets/images/icon.png')}
          style={splashStyles.icon}
          resizeMode="contain"
        />
        <Text style={splashStyles.university}>Ankara Üniversitesi</Text>
        <Text style={splashStyles.subtitle}>Mobil Dil Öğrenme Asistanı</Text>
      </Animated.View>
    );
  }

  return (
    <ThemeProvider value={navigationTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="study"
          options={{
            headerShown: false,
            presentation: 'fullScreenModal',
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="create-deck"
          options={{
            headerShown: false,
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="setting-modal"
          options={{
            headerShown: false,
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
        />
<Stack.Screen
          name="deck-detail"
          options={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="quiz-mc"
          options={{
            headerShown: false,
            presentation: 'fullScreenModal',
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="quiz-match"
          options={{
            headerShown: false,
            presentation: 'fullScreenModal',
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="quiz-spell"
          options={{
            headerShown: false,
            presentation: 'fullScreenModal',
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="onboarding"
          options={{ headerShown: false, animation: 'fade' }}
        />
      </Stack>
      <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}

const splashStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F23',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  icon: {
    width: 120,
    height: 120,
    borderRadius: 24,
  },
  university: {
    color: '#EAEAFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginTop: 8,
  },
  subtitle: {
    color: '#9090C0',
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.3,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});
