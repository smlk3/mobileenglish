import { Tabs } from 'expo-router';
import { useProfileStore } from '../../src/shared/lib/stores/useProfileStore';
import { colors } from '../../src/shared/lib/theme';
import FloatingTabBar from '../../components/FloatingTabBar';

export default function TabLayout() {
  const themeMode = useProfileStore((s) => s.themeMode);
  const tc = themeMode === 'dark' ? colors.dark : colors.light;

  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        tabBarStyle: { display: 'none' },
        headerStyle: { backgroundColor: tc.surface },
        headerTintColor: tc.text,
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '700', fontSize: 17 },
      }}
    >
      <Tabs.Screen name="index"    options={{ headerTitle: 'LinguaLearn' }} />
      <Tabs.Screen name="decks"    options={{ headerTitle: 'My Decks' }} />
      <Tabs.Screen name="stats"    options={{ headerTitle: 'Statistics' }} />
      <Tabs.Screen name="chat"     options={{ headerTitle: 'AI Chat' }} />
      <Tabs.Screen name="settings" options={{ headerTitle: 'Settings' }} />
    </Tabs>
  );
}
