import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { BADGES, LEVELS, getLevelFromXP, getNextLevel } from '../xpSystem';

const STORAGE_KEY = '@lingua_xp_v1';

interface XPData {
  totalXP: number;
  currentLevel: number;
  earnedBadges: string[];
  // counters for badge tracking
  perfectSpellingCount: number;
  totalQuizSessions: number;
  achievedComboX3: boolean;
  // time-based
  hasStudiedLate: boolean;   // after midnight
  hasStudiedEarly: boolean;  // before 7am
}

interface AwardResult {
  leveledUp: boolean;
  newLevel: number;
  newBadges: string[];
  xpAwarded: number;
}

interface XPStore extends XPData {
  isLoaded: boolean;

  // Actions
  loadFromStorage: () => Promise<void>;
  awardXP: (amount: number, context?: Partial<BadgeContext>) => Promise<AwardResult>;
  reset: () => Promise<void>;
}

export interface BadgeContext {
  isFirstSession?: boolean;
  streak?: number;
  isPerfectQuiz?: boolean;
  isPerfectSpelling?: boolean;
  isHighAccuracyMC?: boolean;
  isComboX3?: boolean;
  totalWordsLearned?: number;
  totalDecks?: number;
  studiedAllCardsInDeck?: boolean;
  newLevel?: number;
  isSessionEnd?: boolean; // Bug #2: only increment quiz counter at session end
}

const DEFAULT_DATA: XPData = {
  totalXP: 0,
  currentLevel: 1,
  earnedBadges: [],
  perfectSpellingCount: 0,
  totalQuizSessions: 0,
  achievedComboX3: false,
  hasStudiedLate: false,
  hasStudiedEarly: false,
};

async function loadData(): Promise<XPData> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_DATA;
    return { ...DEFAULT_DATA, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_DATA;
  }
}

async function saveData(data: XPData): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch { /* ignore */ }
}

function checkBadgesForContext(
  data: XPData,
  context: BadgeContext,
): string[] {
  const earned = new Set(data.earnedBadges);
  const newBadges: string[] = [];

  const maybeAdd = (id: string, condition: boolean) => {
    if (condition && !earned.has(id)) {
      newBadges.push(id);
      earned.add(id);
    }
  };

  const hour = new Date().getHours();

  maybeAdd('first_steps', !!context.isFirstSession);
  maybeAdd('on_fire', (context.streak ?? 0) >= 5);
  maybeAdd('dedicated', (context.streak ?? 0) >= 30);
  maybeAdd('perfect_quiz', !!context.isPerfectQuiz);
  maybeAdd('spelling_bee', data.perfectSpellingCount >= 3 || !!context.isPerfectSpelling && data.perfectSpellingCount + 1 >= 3);
  maybeAdd('sharpshooter', !!context.isHighAccuracyMC);
  maybeAdd('combo_king', !!context.isComboX3 || data.achievedComboX3);
  maybeAdd('word_collector', (context.totalWordsLearned ?? 0) >= 100);
  maybeAdd('bookworm', (context.totalWordsLearned ?? 0) >= 500);
  maybeAdd('word_master', (context.totalWordsLearned ?? 0) >= 1000);
  maybeAdd('library', (context.totalDecks ?? 0) >= 5);
  maybeAdd('explorer', !!context.studiedAllCardsInDeck);
  maybeAdd('champion', (context.newLevel ?? data.currentLevel) >= 10);
  maybeAdd('night_owl', hour >= 0 && hour < 5);
  maybeAdd('early_bird', hour >= 5 && hour < 7);
  maybeAdd('centurion', data.totalQuizSessions + 1 >= 100);

  return newBadges;
}

export const useXPStore = create<XPStore>((set, get) => ({
  ...DEFAULT_DATA,
  isLoaded: false,

  loadFromStorage: async () => {
    const data = await loadData();
    set({ ...data, isLoaded: true });
  },

  awardXP: async (amount: number, context: Partial<BadgeContext> = {}): Promise<AwardResult> => {
    const state = get();
    const oldData: XPData = {
      totalXP: state.totalXP,
      currentLevel: state.currentLevel,
      earnedBadges: [...state.earnedBadges],
      perfectSpellingCount: state.perfectSpellingCount,
      totalQuizSessions: state.totalQuizSessions,
      achievedComboX3: state.achievedComboX3,
      hasStudiedLate: state.hasStudiedLate,
      hasStudiedEarly: state.hasStudiedEarly,
    };

    const newTotalXP = oldData.totalXP + amount;
    const oldLevel = getLevelFromXP(oldData.totalXP);
    const newLevel = getLevelFromXP(newTotalXP);
    const leveledUp = newLevel.level > oldLevel.level;

    // Update counters
    const hour = new Date().getHours();
    const newData: XPData = {
      ...oldData,
      totalXP: newTotalXP,
      currentLevel: newLevel.level,
      perfectSpellingCount: context.isPerfectSpelling
        ? oldData.perfectSpellingCount + 1
        : oldData.perfectSpellingCount,
      // Bug #2: only count as a quiz session when explicitly flagged
      totalQuizSessions: context.isSessionEnd
        ? oldData.totalQuizSessions + 1
        : oldData.totalQuizSessions,
      achievedComboX3: oldData.achievedComboX3 || !!context.isComboX3,
      hasStudiedLate: oldData.hasStudiedLate || (hour >= 0 && hour < 5),
      hasStudiedEarly: oldData.hasStudiedEarly || (hour >= 5 && hour < 7),
    };

    // Check badges
    const fullContext: BadgeContext = {
      ...context,
      newLevel: newLevel.level,
      isFirstSession: oldData.totalQuizSessions === 0,
    };
    const newBadges = checkBadgesForContext(newData, fullContext);
    newData.earnedBadges = [...oldData.earnedBadges, ...newBadges];

    await saveData(newData);
    set({ ...newData, isLoaded: true });

    return {
      leveledUp,
      newLevel: newLevel.level,
      newBadges,
      xpAwarded: amount,
    };
  },

  reset: async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    set({ ...DEFAULT_DATA, isLoaded: true });
  },
}));

// Initialize on import
useXPStore.getState().loadFromStorage();
