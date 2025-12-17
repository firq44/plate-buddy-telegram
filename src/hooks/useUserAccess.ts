import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTelegram } from '@/contexts/TelegramContext';

export type AccessStatus = 'loading' | 'approved' | 'pending' | 'rejected' | 'no-request';

export const useUserAccess = () => {
  const { user, isReady } = useTelegram();
  const [status, setStatus] = useState<AccessStatus>('loading');
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isReady || !user) {
      setStatus('loading');
      return;
    }

    // Wait for Supabase session to be established
    const waitForSession = async () => {
      setIsCheckingSession(true);
      try {
        // Wait a bit for auth session to be set
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Verify session exists
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          // Wait a bit more and try again
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } finally {
        setIsCheckingSession(false);
      }
    };

    waitForSession();
  }, [isReady, user]);

  useEffect(() => {
    if (!isReady || !user || isCheckingSession) {
      return;
    }

    const MAX_RETRIES = 5;

    const checkAccess = async () => {
      try {
        // Verify we have a valid session before checking roles
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          console.log('No session found, waiting...');

          if (retryCountRef.current < MAX_RETRIES) {
            retryCountRef.current += 1;

            if (retryTimeoutRef.current) {
              clearTimeout(retryTimeoutRef.current);
            }

            retryTimeoutRef.current = window.setTimeout(() => {
              checkAccess();
            }, 800);

            setStatus('loading');
          } else {
            console.log('No session found after retries, treating as no-request');
            setStatus('no-request');
          }
          return;
        }

        // Reset retry counter once we have a session
        retryCountRef.current = 0;

        // Check if user exists and get their ID
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('id')
          .eq('telegram_id', user.id.toString())
          .maybeSingle();

        if (userError) throw userError;

        if (userData) {
          // Check if user has ANY role (user or admin)
          const { data: rolesData, error: rolesError } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', userData.id);

          if (rolesError) throw rolesError;

          // User exists and has roles - they have access
          if (rolesData && rolesData.length > 0) {
            const hasAdminRole = rolesData.some(r => r.role === 'admin');
            setIsAdmin(hasAdminRole);
            setStatus('approved');
            return;
          }
          
          // User exists but has NO roles - check for pending request
          // DON'T sign out - keep session active so realtime updates work
        }

        // Check if there's a pending request
        const { data: requestData, error: requestError } = await supabase
          .from('access_requests')
          .select('status')
          .eq('telegram_id', user.id.toString())
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (requestError) throw requestError;

        if (requestData) {
          if (requestData.status === 'pending') {
            setStatus('pending');
          } else if (requestData.status === 'rejected') {
            setStatus('rejected');
          } else {
            // 'approved' but no roles or no user record - need new request
            setStatus('no-request');
          }
        } else {
          setStatus('no-request');
        }
      } catch (error) {
        console.error('Error checking access:', error);
        setStatus('no-request');
      }
    };

    checkAccess();

    // Subscribe to realtime changes
    const channel = supabase
      .channel('user-access-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'users',
          filter: `telegram_id=eq.${user.id}`,
        },
        () => checkAccess()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'access_requests',
          filter: `telegram_id=eq.${user.id}`,
        },
        () => checkAccess()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_roles',
        },
        () => checkAccess()
      )
      .subscribe();

    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      supabase.removeChannel(channel);
    };
  }, [user, isReady, isCheckingSession]);

  return { status, isAdmin };
};
