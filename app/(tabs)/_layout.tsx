import { Tabs } from 'expo-router';
import FloatingTabBar from '../../components/FloatingTabBar';

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        // Hide the default tab bar — FloatingTabBar renders absolutely positioned
        tabBarStyle: { display: 'none' },
        headerShown: false,
      }}
    >
      <Tabs.Screen name="index"    options={{ title: 'Home' }} />
      <Tabs.Screen name="decks"    options={{ title: 'Decks' }} />
      <Tabs.Screen name="stats"    options={{ title: 'Stats' }} />
      <Tabs.Screen name="chat"     options={{ title: 'AI Chat' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}
