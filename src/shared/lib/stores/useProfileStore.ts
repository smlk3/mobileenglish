import { create } from 'zustand';
import type { ThemeMode } from '../theme';

interface ProfileState {
    // Theme
    themeMode: ThemeMode;
    setThemeMode: (mode: ThemeMode) => void;
    toggleTheme: () => void;

    // Profile info (ephemeral, synced from DB)
    profession: string;
    interests: string[];
    level: string;
    nativeLanguage: string;
    targetLanguage: string;
    goals: string[];

    // Onboarding
    onboardingCompleted: boolean;
    setOnboardingCompleted: (v: boolean) => void;

    // Daily goal
    dailyGoal: number;
    setDailyGoal: (n: number) => void;

    // AI status
    isCloudAvailable: boolean;
    activeModel: 'cloud' | 'none';

    // Actions
    setProfile: (profile: {
        profession: string;
        interests: string[];
        level: string;
        nativeLanguage: string;
        goals: string[];
    }) => void;
    setTargetLanguage: (lang: string) => void;
    setCloudAvailable: (available: boolean) => void;
    setActiveModel: (model: 'cloud' | 'none') => void;
}

export const useProfileStore = create<ProfileState>((set) => ({
    themeMode: 'dark',
    setThemeMode: (mode) => set({ themeMode: mode }),
    toggleTheme: () =>
        set((state) => ({ themeMode: state.themeMode === 'dark' ? 'light' : 'dark' })),

    profession: '',
    interests: [],
    level: 'A1',
    nativeLanguage: 'tr',
    targetLanguage: 'en',
    goals: [],

    onboardingCompleted: false,
    setOnboardingCompleted: (v) => set({ onboardingCompleted: v }),

    dailyGoal: 20,
    setDailyGoal: (n) => set({ dailyGoal: n }),

    isCloudAvailable: false,
    activeModel: 'none',

    setProfile: (profile) => set(profile),
    setTargetLanguage: (lang) => set({ targetLanguage: lang }),
    setCloudAvailable: (available) => set({ isCloudAvailable: available }),
    setActiveModel: (model) => set({ activeModel: model }),
}));
