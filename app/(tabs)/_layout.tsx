import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useProfileStore } from '../../src/shared/lib/stores/useProfileStore';
import { colors } from '../../src/shared/lib/theme';
import FloatingTabBar from '../../components/FloatingTabBar';

export default function TabLayout() {
  const { t } = useTranslation();
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
      <Tabs.Screen name="index"    options={{ headerTitle: t('tabs.home') }} />
      <Tabs.Screen name="decks"    options={{ headerTitle: t('tabs.decks') }} />
      <Tabs.Screen name="stats"    options={{ headerTitle: t('tabs.stats') }} />
      <Tabs.Screen name="chat"     options={{ headerTitle: t('tabs.chat') }} />
      <Tabs.Screen name="settings" options={{ headerTitle: t('tabs.settings') }} />
    </Tabs>
  );
}
