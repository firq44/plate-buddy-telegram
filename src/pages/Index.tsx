import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTelegram } from '@/contexts/TelegramContext';
import { useUserAccess } from '@/hooks/useUserAccess';
import { AccessRequest } from '@/components/AccessRequest';
import { PendingRequest } from '@/components/PendingRequest';
import { RejectedRequest } from '@/components/RejectedRequest';
import { Loader2 } from 'lucide-react';

const Index = () => {
  const { isReady } = useTelegram();
  const { status, isAdmin } = useUserAccess();
  const navigate = useNavigate();

  useEffect(() => {
    if (status === 'approved') {
      navigate(isAdmin ? '/admin' : '/checker');
    }
  }, [status, isAdmin, navigate]);

  if (!isReady || status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  if (status === 'pending') {
    return <PendingRequest />;
  }

  if (status === 'rejected') {
    return <RejectedRequest />;
  }

  return <AccessRequest />;
};

export default Index;
