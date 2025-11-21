import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTelegram } from '@/contexts/TelegramContext';

export type AccessStatus = 'loading' | 'approved' | 'pending' | 'rejected' | 'no-request';

export const useUserAccess = () => {
  const { user, isReady } = useTelegram();
  const [status, setStatus] = useState<AccessStatus>('loading');
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!isReady || !user) {
      setStatus('loading');
      return;
    }

    const checkAccess = async () => {
      try {
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

          // User exists but has NO roles - they were removed/deleted
          if (!rolesData || rolesData.length === 0) {
            setIsAdmin(false);
            setStatus('no-request');
            return;
          }

          // User has at least one role - they have access
          const hasAdminRole = rolesData.some(r => r.role === 'admin');
          setIsAdmin(hasAdminRole);
          setStatus('approved');
          return;
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
          setStatus(requestData.status as AccessStatus);
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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, isReady]);

  return { status, isAdmin };
};
