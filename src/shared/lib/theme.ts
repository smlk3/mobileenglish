/**
 * Design System Theme - LinguaLearn
 * Dark-first design with vibrant accent colors
 */

export const colors = {
    // Brand colors
    primary: {
        50: '#EEF2FF',
        100: '#E0E7FF',
        200: '#C7D2FE',
        300: '#A5B4FC',
        400: '#818CF8',
        500: '#6366F1', // Main primary
        600: '#4F46E5',
        700: '#4338CA',
        800: '#3730A3',
        900: '#312E81',
    },
    accent: {
        50: '#F0FDFA',
        100: '#CCFBF1',
        200: '#99F6E4',
        300: '#5EEAD4',
        400: '#2DD4BF', // Main accent
        500: '#14B8A6',
        600: '#0D9488',
        700: '#0F766E',
        800: '#115E59',
        900: '#134E4A',
    },
    success: {
        light: '#34D399',
        main: '#10B981',
        dark: '#059669',
    },
    warning: {
        light: '#FBBF24',
        main: '#F59E0B',
        dark: '#D97706',
    },
    error: {
        light: '#F87171',
        main: '#EF4444',
        dark: '#DC2626',
    },

    // Dark theme (default)
    dark: {
        background: '#0F0F23',
        surface: '#1A1A2E',
        surfaceElevated: '#252542',
        card: '#16213E',
        border: '#2A2A4A',
        text: '#EAEAFF',
        textSecondary: '#9CA3AF',
        textMuted: '#6B7280',
    },

    // Light theme
    light: {
        background: '#F8FAFC',
        surface: '#FFFFFF',
        surfaceElevated: '#F1F5F9',
        card: '#FFFFFF',
        border: '#E2E8F0',
        text: '#0F172A',
        textSecondary: '#475569',
        textMuted: '#94A3B8',
    },
};

export const typography = {
    fontFamily: {
        regular: 'Inter-Regular',
        medium: 'Inter-Medium',
        semiBold: 'Inter-SemiBold',
        bold: 'Inter-Bold',
        // Fallback system fonts
        system: 'System',
    },
    fontSize: {
        xs: 11,
        sm: 13,
        base: 15,
        md: 17,
        lg: 20,
        xl: 24,
        '2xl': 30,
        '3xl': 36,
        '4xl': 48,
    },
    lineHeight: {
        tight: 1.2,
        normal: 1.5,
        relaxed: 1.75,
    },
};

export const spacing = {
    xs: 4,
    sm: 8,
    md: 12,
    base: 16,
    lg: 20,
    xl: 24,
    '2xl': 32,
    '3xl': 40,
    '4xl': 48,
    '5xl': 64,
};

export const borderRadius = {
    sm: 6,
    md: 10,
    lg: 16,
    xl: 20,
    '2xl': 28,
    full: 9999,
};

export const shadows = {
    sm: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.15,
        shadowRadius: 2,
        elevation: 2,
    },
    md: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
        elevation: 5,
    },
    lg: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
        elevation: 10,
    },
    glow: (color: string) => ({
        shadowColor: color,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
        elevation: 8,
    }),
};

export type ThemeMode = 'dark' | 'light';

export const getThemeColors = (mode: ThemeMode) => ({
    ...(mode === 'dark' ? colors.dark : colors.light),
    primary: colors.primary,
    accent: colors.accent,
    success: colors.success,
    warning: colors.warning,
    error: colors.error,
});

export type ThemeColors = ReturnType<typeof getThemeColors>;

export const theme = {
    colors,
    typography,
    spacing,
    borderRadius,
    shadows,
};

export default theme;
