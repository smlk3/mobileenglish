import { Tabs } from 'expo-router';
import FloatingTabBar from '../../components/FloatingTabBar';

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarStyle: { display: 'none' },
      }}
    >
      <Tabs.Screen name="index"    />
      <Tabs.Screen name="decks"    />
      <Tabs.Screen name="stats"    />
      <Tabs.Screen name="chat"     />
      <Tabs.Screen name="settings" />
    </Tabs>
  );
}
