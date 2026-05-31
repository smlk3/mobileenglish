/**
 * Aurora Dark — Design System
 * Violet + Cyan palette, glassmorphism, gradient-heavy
 */

// ─── Core Palette ────────────────────────────────────────────────
export const colors = {
    primary: {
        50:  '#F5F3FF',
        100: '#EDE9FE',
        200: '#DDD6FE',
        300: '#C4B5FD',
        400: '#A78BFA',
        500: '#8B5CF6', // Main violet
        600: '#7C3AED',
        700: '#6D28D9',
        800: '#5B21B6',
        900: '#4C1D95',
    },
    secondary: {
        50:  '#ECFEFF',
        100: '#CFFAFE',
        200: '#A5F3FC',
        300: '#67E8F9',
        400: '#22D3EE',
        500: '#06B6D4', // Main cyan
        600: '#0891B2',
        700: '#0E7490',
        800: '#155E75',
        900: '#164E63',
    },
    gold: {
        50:  '#FFFBEB',
        100: '#FEF3C7',
        200: '#FDE68A',
        300: '#FCD34D',
        400: '#FBBF24',
        500: '#F59E0B', // Main gold (streak/XP)
        600: '#D97706',
        700: '#B45309',
        800: '#92400E',
        900: '#78350F',
    },
    success: {
        light: '#34D399',
        main:  '#10B981',
        dark:  '#059669',
    },
    warning: {
        light: '#FBBF24',
        main:  '#F59E0B',
        dark:  '#D97706',
    },
    error: {
        light: '#F87171',
        main:  '#EF4444',
        dark:  '#DC2626',
    },

    // Dark theme
    dark: {
        background:      '#08090F',
        surface:         '#0F1117',
        surfaceElevated: '#161820',
        card:            '#13141C',
        border:          '#1E2030',
        borderSubtle:    '#161820',
        text:            '#F0F0FF',
        textSecondary:   '#9CA3AF',
        textMuted:       '#4B5563',
    },

    // Backward-compat: eski ekranlar colors.accent kullanıyor
    accent: {
        50:  '#ECFEFF',
        100: '#CFFAFE',
        200: '#A5F3FC',
        300: '#67E8F9',
        400: '#22D3EE',
        500: '#06B6D4',
        600: '#0891B2',
        700: '#0E7490',
        800: '#155E75',
        900: '#164E63',
    },

    // Light theme
    light: {
        background:      '#F8FAFC',
        surface:         '#FFFFFF',
        surfaceElevated: '#F1F5F9',
        card:            '#FFFFFF',
        border:          '#E2E8F0',
        borderSubtle:    '#F1F5F9',
        text:            '#0F172A',
        textSecondary:   '#475569',
        textMuted:       '#94A3B8',
    },
};

// ─── Gradients ────────────────────────────────────────────────────
export const gradients = {
    // Main CTA — Violet → Cyan
    aurora:   ['#7C3AED', '#06B6D4'] as const,
    // Warmer variant
    sunset:   ['#7C3AED', '#EC4899'] as const,
    // Streak / fire
    fire:     ['#F59E0B', '#EF4444'] as const,
    // Success / completion
    emerald:  ['#10B981', '#06B6D4'] as const,
    // Hero background (dark)
    heroDark: ['#12033A', '#0A1628', '#08090F'] as const,
    // Hero background (light)
    heroLight:['#EDE9FE', '#CFFAFE', '#F8FAFC'] as const,
    // Card glass overlay
    glassDark:['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.02)'] as const,
};

// ─── Glass Morphism ────────────────────────────────────────────────
export const glass = {
    dark: {
        backgroundColor: 'rgba(15,17,23,0.72)',
        borderColor:     'rgba(255,255,255,0.08)',
        borderWidth:     1,
    },
    light: {
        backgroundColor: 'rgba(255,255,255,0.72)',
        borderColor:     'rgba(0,0,0,0.06)',
        borderWidth:     1,
    },
};

// ─── Typography ────────────────────────────────────────────────────
export const typography = {
    fontFamily: {
        regular:  'Inter-Regular',
        medium:   'Inter-Medium',
        semiBold: 'Inter-SemiBold',
        bold:     'Inter-Bold',
        system:   'System',
    },
    fontSize: {
        xs:   11,
        sm:   13,
        base: 15,
        md:   17,
        lg:   20,
        xl:   24,
        '2xl': 30,
        '3xl': 36,
        '4xl': 48,
    },
    lineHeight: {
        tight:   1.2,
        normal:  1.5,
        relaxed: 1.75,
    },
    letterSpacing: {
        tight:  -0.5,
        normal: 0,
        wide:   0.5,
        wider:  1,
    },
};

// ─── Spacing ──────────────────────────────────────────────────────
export const spacing = {
    xs:   4,
    sm:   8,
    md:   12,
    base: 16,
    lg:   20,
    xl:   24,
    '2xl': 32,
    '3xl': 40,
    '4xl': 48,
    '5xl': 64,
};

// ─── Border Radius ────────────────────────────────────────────────
export const borderRadius = {
    sm:   6,
    md:   10,
    lg:   16,
    xl:   20,
    '2xl': 28,
    '3xl': 36,
    full: 9999,
};

// ─── Shadows ──────────────────────────────────────────────────────
export const shadows = {
    sm: {
        shadowColor:  '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
        elevation: 2,
    },
    md: {
        shadowColor:  '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 5,
    },
    lg: {
        shadowColor:  '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 10,
    },
    // Renkli glow gölgesi
    glow: (color: string, intensity: number = 0.45) => ({
        shadowColor:  color,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: intensity,
        shadowRadius: 20,
        elevation: 8,
    }),
    glowSm: (color: string) => ({
        shadowColor:  color,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
        elevation: 4,
    }),
};

// ─── Animation Tokens ─────────────────────────────────────────────
export const animation = {
    duration: {
        fast:   180,
        normal: 320,
        slow:   500,
        slower: 700,
    },
    // spring config için referans değerler
    spring: {
        gentle:  { damping: 18, stiffness: 120 },
        bouncy:  { damping: 12, stiffness: 180 },
        snappy:  { damping: 22, stiffness: 250 },
    },
};

// ─── Theme Helper ─────────────────────────────────────────────────
export type ThemeMode = 'dark' | 'light';

export const getThemeColors = (mode: ThemeMode) => ({
    ...(mode === 'dark' ? colors.dark : colors.light),
    primary:   colors.primary,
    secondary: colors.secondary,
    accent:    colors.accent,
    gold:      colors.gold,
    success:   colors.success,
    warning:   colors.warning,
    error:     colors.error,
});

export type ThemeColors = ReturnType<typeof getThemeColors>;

export const theme = {
    colors,
    gradients,
    glass,
    typography,
    spacing,
    borderRadius,
    shadows,
    animation,
};

export default theme;
