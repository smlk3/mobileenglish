import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useProfileStore } from '../src/shared/lib/stores/useProfileStore';
import { colors } from '../src/shared/lib/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_CONFIG: Record<string, { focused: IoniconName; unfocused: IoniconName }> = {
  index:    { focused: 'home',                unfocused: 'home-outline' },
  decks:    { focused: 'library',             unfocused: 'library-outline' },
  stats:    { focused: 'bar-chart',           unfocused: 'bar-chart-outline' },
  chat:     { focused: 'chatbubble-ellipses', unfocused: 'chatbubble-ellipses-outline' },
  settings: { focused: 'settings',           unfocused: 'settings-outline' },
};

function TabItem({
  name,
  isFocused,
  onPress,
  onLongPress,
  isDark,
}: {
  name: string;
  isFocused: boolean;
  onPress: () => void;
  onLongPress: () => void;
  isDark: boolean;
}) {
  const scale       = useSharedValue(isFocused ? 1.05 : 1);
  const glowOpacity = useSharedValue(isFocused ? 1 : 0);

  useEffect(() => {
    scale.value       = withSpring(isFocused ? 1.05 : 1, { damping: 10, stiffness: 200 });
    glowOpacity.value = withSpring(isFocused ? 1 : 0,    { damping: 14, stiffness: 160 });
  }, [isFocused]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const icons = TAB_CONFIG[name] ?? { focused: 'ellipse', unfocused: 'ellipse-outline' };

  return (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.75}
      style={st.tabItem}
      accessibilityRole="button"
      accessibilityState={{ selected: isFocused }}
    >
      <Animated.View style={[st.halo, glowStyle]} />
      <Animated.View style={[st.iconWrap, isFocused && st.iconWrapActive, iconStyle]}>
        <Ionicons
          name={isFocused ? icons.focused : icons.unfocused}
          size={22}
          color={
            isFocused
              ? '#ffffff'
              : isDark
              ? colors.dark.textMuted
              : colors.light.textMuted
          }
        />
      </Animated.View>
    </TouchableOpacity>
  );
}

export default function FloatingTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const isDark = useProfileStore((s) => s.themeMode) === 'dark';

  // paddingBottom = safe area (home indicator) + a small gap
  const bottomPad = insets.bottom + (Platform.OS === 'android' ? 8 : 6);

  return (
    // This is a NORMAL layout element (not absolute) so navigation
    // correctly reserves space at the bottom of each screen.
    <View
      style={[
        st.wrapper,
        { paddingBottom: bottomPad, backgroundColor: isDark ? colors.dark.background : colors.light.background },
      ]}
    >
      <View style={[st.pill, isDark ? st.pillDark : st.pillLight]}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name as never);
            }
          };

          const onLongPress = () => {
            navigation.emit({ type: 'tabLongPress', target: route.key });
          };

          return (
            <TabItem
              key={route.key}
              name={route.name}
              isFocused={isFocused}
              onPress={onPress}
              onLongPress={onLongPress}
              isDark={isDark}
            />
          );
        })}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  // Wrapper takes normal layout space — no overflow issues
  wrapper: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  pill: {
    flexDirection: 'row',
    borderRadius: 9999,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'space-around',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 16,
  },
  pillDark: {
    backgroundColor: 'rgba(22, 22, 42, 0.98)',
    borderColor: `${colors.primary[500]}40`,
    shadowColor: colors.primary[600],
  },
  pillLight: {
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderColor: `${colors.primary[300]}50`,
    shadowColor: colors.primary[400],
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  halo: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: `${colors.primary[400]}14`,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: colors.primary[500],
    shadowColor: colors.primary[300],
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 12,
    elevation: 8,
  },
});
