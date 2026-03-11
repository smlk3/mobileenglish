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
    goals: string[];

    // AI status
    isLocalModelLoaded: boolean;
    isCloudAvailable: boolean;
    activeModel: 'local' | 'cloud' | 'none';
    activeLocalModelId: string | null;

    // Actions
    setProfile: (profile: {
        profession: string;
        interests: string[];
        level: string;
        nativeLanguage: string;
        goals: string[];
    }) => void;
    setLocalModelLoaded: (loaded: boolean) => void;
    setCloudAvailable: (available: boolean) => void;
    setActiveModel: (model: 'local' | 'cloud' | 'none') => void;
    setActiveLocalModelId: (id: string | null) => void;
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
    goals: [],

    isLocalModelLoaded: false,
    isCloudAvailable: false,
    activeModel: 'none',
    activeLocalModelId: null,

    setProfile: (profile) => set(profile),
    setLocalModelLoaded: (loaded) => set({ isLocalModelLoaded: loaded }),
    setCloudAvailable: (available) => set({ isCloudAvailable: available }),
    setActiveModel: (model) => set({ activeModel: model }),
    setActiveLocalModelId: (id: string | null) => set(
        (state) => ({ ...state, activeLocalModelId: id })
    ),
}));
