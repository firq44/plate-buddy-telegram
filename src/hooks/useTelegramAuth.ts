import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTelegram } from '@/contexts/TelegramContext';

export const useTelegramAuth = () => {
  const { webApp, isReady } = useTelegram();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(true);

  useEffect(() => {
    if (!isReady) {
      setIsAuthenticating(false);
      return;
    }

    if (!webApp?.initData) {
      setIsAuthenticating(false);
      return;
    }

    const authenticate = async () => {
      try {
        // Check if already authenticated
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          setIsAuthenticated(true);
          setIsAuthenticating(false);
          return;
        }

        // Authenticate with Telegram data
        const { data, error } = await supabase.functions.invoke('telegram-auth', {
          body: { initData: webApp.initData },
        });

        if (error) throw error;

        if (data?.access_token && data?.refresh_token) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: data.access_token,
            refresh_token: data.refresh_token,
          });

          if (sessionError) throw sessionError;

          setIsAuthenticated(true);
        }
      } catch (error) {
        console.error('Authentication error:', error);
      } finally {
        setIsAuthenticating(false);
      }
    };

    authenticate();
  }, [webApp, isReady]);

  return { isAuthenticated, isAuthenticating };
};
