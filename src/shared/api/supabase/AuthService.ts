import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from './client';

WebBrowser.maybeCompleteAuthSession();

export const AuthService = {
  async signInWithGoogle() {
    try {
      const redirectUrl = AuthSession.makeRedirectUri({
        scheme: 'lingualearn',
        path: 'auth/callback',
      });

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;
      if (!data?.url) return null;

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
      if (result.type !== 'success' || !result.url) return null;

      // PKCE flow (supabase-js default): redirect carries a ?code= to exchange.
      const url = new URL(result.url);
      const code = url.searchParams.get('code');
      if (code) {
        const { data: sessionData, error: exchangeError } =
          await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) throw exchangeError;
        return sessionData.session;
      }

      // Implicit flow fallback: tokens arrive in the URL fragment.
      const fragment = result.url.split('#')[1] ?? '';
      const params = new URLSearchParams(fragment);
      const access_token = params.get('access_token');
      const refresh_token = params.get('refresh_token');
      if (access_token && refresh_token) {
        const { data: sessionData, error: setError } =
          await supabase.auth.setSession({ access_token, refresh_token });
        if (setError) throw setError;
        return sessionData.session;
      }

      return null;
    } catch (error) {
      console.error('Google Sign-In Error:', error);
      throw error;
    }
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async getSession() {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    return session;
  },

  onAuthStateChange(callback: (event: string, session: any) => void) {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        callback(event, session);
      }
    );
    return subscription;
  }
};
