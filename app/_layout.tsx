import 'react-native-get-random-values';
import '../src/shared/i18n'; // i18n must be initialized before any screen renders
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import 'react-native-reanimated';
import i18n from '../src/shared/i18n';

import { initializeDefaultSettings } from '../src/entities/database';
import HybridLLMManager from '../src/shared/api/llm/HybridLLMManager';
import { getUserSettings } from '../src/shared/lib/stores/useDatabaseService';
import { useProfileStore } from '../src/shared/lib/stores/useProfileStore';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const themeMode = useProfileStore((s) => s.themeMode);
  const router = useRouter();
  const didInit = useRef(false);

  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;

    const init = async () => {
      // Initialize database defaults
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

        // Redirect to onboarding if not completed
        if (!settings.onboardingCompleted) {
          router.replace('/onboarding' as any);
        }
      }
    };

    init().catch(console.error);
  }, []);

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
          name="onboarding"
          options={{ headerShown: false, animation: 'fade' }}
        />
        <Stack.Screen
          name="modal"
          options={{ presentation: 'modal', title: 'Modal' }}
        />
      </Stack>
      <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}
