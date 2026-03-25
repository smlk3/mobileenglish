// ─── XP System Core ───────────────────────────────────────
// All XP values, 20-level progression table, and 16 badge definitions

// ── XP Award Values ───────────────────────────────────────
export const XP = {
  // Flashcard
  FLASHCARD_CORRECT: 8,
  FLASHCARD_WRONG: 2,

  // Multiple Choice Quiz
  MC_CORRECT: 12,
  MC_COMBO_X2_BONUS: 8,
  MC_COMBO_X3_BONUS: 15,
  MC_PERFECT_BONUS: 50,

  // Spelling
  SPELL_CORRECT_NO_HINT: 20,
  SPELL_CORRECT_WITH_HINT: 8,
  SPELL_ALMOST: 5,
  SPELL_PERFECT_BONUS: 60,

  // Matching
  MATCH_PER_PAIR: 10,
  MATCH_PERFECT_BONUS: 40,

  // Daily bonuses
  DAILY_GOAL_COMPLETE: 75,
  STREAK_PER_DAY: 3, // multiplied by streak count
} as const;

// ── 20-Level Progression Table ─────────────────────────────
export interface LevelInfo {
  level: number;
  title: string;
  emoji: string;
  xpRequired: number; // cumulative XP to reach this level
  color: string;
}

export const LEVELS: LevelInfo[] = [
  { level: 1,  title: 'Newcomer',    emoji: '🌱', xpRequired: 0,       color: '#6EE7B7' },
  { level: 2,  title: 'Curious',     emoji: '🔍', xpRequired: 300,     color: '#6EE7B7' },
  { level: 3,  title: 'Explorer',    emoji: '🗺️', xpRequired: 800,     color: '#34D399' },
  { level: 4,  title: 'Student',     emoji: '📖', xpRequired: 1800,    color: '#10B981' },
  { level: 5,  title: 'Learner',     emoji: '🎒', xpRequired: 3500,    color: '#6366F1' },
  { level: 6,  title: 'Scholar',     emoji: '⚡', xpRequired: 6000,    color: '#6366F1' },
  { level: 7,  title: 'Thinker',     emoji: '💡', xpRequired: 10000,   color: '#8B5CF6' },
  { level: 8,  title: 'Linguist',    emoji: '🌐', xpRequired: 15000,   color: '#8B5CF6' },
  { level: 9,  title: 'Polyglot',    emoji: '🗣️', xpRequired: 22000,   color: '#A78BFA' },
  { level: 10, title: 'Expert',      emoji: '🎯', xpRequired: 32000,   color: '#F59E0B' },
  { level: 11, title: 'Veteran',     emoji: '🛡️', xpRequired: 45000,   color: '#F59E0B' },
  { level: 12, title: 'Champion',    emoji: '🏆', xpRequired: 62000,   color: '#EF4444' },
  { level: 13, title: 'Master',      emoji: '🔥', xpRequired: 85000,   color: '#EF4444' },
  { level: 14, title: 'Grand Master',emoji: '👑', xpRequired: 115000,  color: '#DC2626' },
  { level: 15, title: 'Sage',        emoji: '🧙', xpRequired: 155000,  color: '#7C3AED' },
  { level: 16, title: 'Oracle',      emoji: '🔮', xpRequired: 205000,  color: '#7C3AED' },
  { level: 17, title: 'Prodigy',     emoji: '✨', xpRequired: 270000,  color: '#DB2777' },
  { level: 18, title: 'Legend',      emoji: '⭐', xpRequired: 350000,  color: '#DB2777' },
  { level: 19, title: 'Mythic',      emoji: '🌟', xpRequired: 500000,  color: '#9D174D' },
  { level: 20, title: 'Immortal',    emoji: '💎', xpRequired: 750000,  color: '#1E1B4B' },
];

export function getLevelFromXP(totalXP: number): LevelInfo {
  let current = LEVELS[0];
  for (const level of LEVELS) {
    if (totalXP >= level.xpRequired) current = level;
    else break;
  }
  return current;
}

export function getNextLevel(currentLevel: number): LevelInfo | null {
  const next = LEVELS.find((l) => l.level === currentLevel + 1);
  return next ?? null;
}

export function getXPProgress(totalXP: number): {
  current: LevelInfo;
  next: LevelInfo | null;
  xpIntoLevel: number;
  xpForLevel: number;
  pct: number;
} {
  const current = getLevelFromXP(totalXP);
  const next = getNextLevel(current.level);
  if (!next) {
    return { current, next: null, xpIntoLevel: totalXP - current.xpRequired, xpForLevel: 0, pct: 1 };
  }
  const xpIntoLevel = totalXP - current.xpRequired;
  const xpForLevel = next.xpRequired - current.xpRequired;
  return { current, next, xpIntoLevel, xpForLevel, pct: Math.min(xpIntoLevel / xpForLevel, 1) };
}

// ── Badge Definitions ──────────────────────────────────────
export interface BadgeDefinition {
  id: string;
  emoji: string;
  name: string;
  description: string;
  color: string;
}

export const BADGES: BadgeDefinition[] = [
  {
    id: 'first_steps',
    emoji: '🚀',
    name: 'First Steps',
    description: 'Complete your first study session',
    color: '#6366F1',
  },
  {
    id: 'on_fire',
    emoji: '🔥',
    name: 'On Fire',
    description: 'Maintain a 5-day streak',
    color: '#F59E0B',
  },
  {
    id: 'dedicated',
    emoji: '🏆',
    name: 'Dedicated',
    description: 'Maintain a 30-day streak',
    color: '#EF4444',
  },
  {
    id: 'perfect_quiz',
    emoji: '🌟',
    name: 'Perfect Quiz',
    description: 'Complete any quiz with a perfect score',
    color: '#F59E0B',
  },
  {
    id: 'spelling_bee',
    emoji: '✨',
    name: 'Spelling Bee',
    description: 'Complete 3 spelling quizzes without hints',
    color: '#8B5CF6',
  },
  {
    id: 'sharpshooter',
    emoji: '🎯',
    name: 'Sharpshooter',
    description: 'Finish a Multiple Choice quiz with 90%+ accuracy',
    color: '#10B981',
  },
  {
    id: 'combo_king',
    emoji: '🌀',
    name: 'Combo King',
    description: 'Reach a x3 combo in any quiz',
    color: '#6366F1',
  },
  {
    id: 'word_collector',
    emoji: '🧠',
    name: 'Word Collector',
    description: 'Learn 100 words',
    color: '#10B981',
  },
  {
    id: 'bookworm',
    emoji: '📚',
    name: 'Bookworm',
    description: 'Learn 500 words',
    color: '#6366F1',
  },
  {
    id: 'word_master',
    emoji: '💎',
    name: 'Word Master',
    description: 'Learn 1,000 words',
    color: '#DB2777',
  },
  {
    id: 'library',
    emoji: '📖',
    name: 'Library',
    description: 'Create 5 decks',
    color: '#F59E0B',
  },
  {
    id: 'explorer',
    emoji: '🗺️',
    name: 'Explorer',
    description: 'Study every card in a deck',
    color: '#34D399',
  },
  {
    id: 'champion',
    emoji: '🥇',
    name: 'Champion',
    description: 'Reach Level 10',
    color: '#EF4444',
  },
  {
    id: 'night_owl',
    emoji: '🌙',
    name: 'Night Owl',
    description: 'Study after midnight',
    color: '#8B5CF6',
  },
  {
    id: 'early_bird',
    emoji: '☀️',
    name: 'Early Bird',
    description: 'Study before 7am',
    color: '#F59E0B',
  },
  {
    id: 'centurion',
    emoji: '⚡',
    name: 'Centurion',
    description: 'Complete 100 total quiz sessions',
    color: '#6366F1',
  },
];

export function getBadgeById(id: string): BadgeDefinition | undefined {
  return BADGES.find((b) => b.id === id);
}

// ── XP color helper ────────────────────────────────────────
export function getXPColor(amount: number): string {
  if (amount >= 50) return '#F59E0B'; // gold
  if (amount >= 20) return '#8B5CF6'; // purple
  if (amount >= 10) return '#6366F1'; // indigo
  return '#34D399';                   // green
}
