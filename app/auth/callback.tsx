import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { supabase } from '../../src/shared/api/supabase/client';
import { colors } from '../../src/shared/lib/theme';

/**
 * OAuth deep-link callback. Supabase redirects here as `lingualearn://auth/callback?code=...`.
 * We exchange the PKCE code for a session; the onAuthStateChange listener in the root
 * layout then syncs the store and persists supabase_user_id. Finally we return to Settings.
 */
export default function AuthCallback() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string }>();

  useEffect(() => {
    (async () => {
      try {
        if (params.code) {
          const { error } = await supabase.auth.exchangeCodeForSession(params.code);
          if (error) console.warn('[Auth] exchangeCodeForSession failed:', error.message);
        }
      } catch (e) {
        console.warn('[Auth] callback error:', e);
      } finally {
        router.replace('/(tabs)/settings' as any);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.dark.background }}>
      <ActivityIndicator size="large" color={colors.primary[400]} />
    </View>
  );
}
