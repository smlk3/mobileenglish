import 'react-native-get-random-values';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { initializeDefaultSettings } from '../src/entities/database';
import HybridLLMManager from '../src/shared/api/llm/HybridLLMManager';
import ModelDownloadManager, { MODEL_CATALOG } from '../src/shared/api/llm/ModelDownloadManager';
import { getUserSettings } from '../src/shared/lib/stores/useDatabaseService';
import { useProfileStore } from '../src/shared/lib/stores/useProfileStore';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const themeMode = useProfileStore((s) => s.themeMode);

  useEffect(() => {
    const init = async () => {
      // Initialize database defaults
      await initializeDefaultSettings();

      // Initialize local SLM
      const llm = HybridLLMManager.getInstance();
      const manager = ModelDownloadManager.getInstance();
      const downloadedModels = await manager.getDownloadedModels();
      
      let localModelPath: string | undefined;
      let activeLocalModelId: string | null = null;
      if (downloadedModels.length > 0) {
        // Auto-load the newest or previously selected downloaded model 
        const latestModel = downloadedModels.sort((a,b) => b.downloadedAt - a.downloadedAt)[0];
        activeLocalModelId = latestModel.modelId;
        const catalogModel = MODEL_CATALOG.find(m => m.id === activeLocalModelId);
        if (catalogModel) {
            localModelPath = manager.getModelPath(catalogModel);
        }
      }

      await llm.initLocalModel(localModelPath);

      // isLocalReady is false when running in mock mode — reflect the real state
      const isRealLocalModel = llm.getStatus().localReady;
      useProfileStore.getState().setLocalModelLoaded(isRealLocalModel);
      if (isRealLocalModel) {
          useProfileStore.getState().setActiveLocalModelId(activeLocalModelId);
          useProfileStore.getState().setActiveModel('local');
      }

      // Load user settings and configure cloud if API key exists
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

        if (!isRealLocalModel && !keys.openai && !keys.gemini && !keys.custom) {
          useProfileStore.getState().setActiveModel('none');
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
          name="model-manager"
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
          name="modal"
          options={{ presentation: 'modal', title: 'Modal' }}
        />
      </Stack>
      <StatusBar style={themeMode === 'dark' ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}
