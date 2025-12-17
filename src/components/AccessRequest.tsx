import { useState } from 'react';
import { useTelegram } from '@/contexts/TelegramContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { accessRequestSchema } from '@/lib/validation';

export const AccessRequest = () => {
  const { user } = useTelegram();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRequestAccess = async () => {
    if (!user) return;

    setIsSubmitting(true);
    try {
      // Validate input data
      const requestData = {
        telegram_id: user.id.toString(),
        username: user.username,
        first_name: user.first_name,
      };

      const validation = accessRequestSchema.safeParse(requestData);
      if (!validation.success) {
        toast.error('Validation error', {
          description: validation.error.issues[0].message,
        });
        return;
      }

      // Use edge function to create access request (bypasses RLS issues)
      const { data, error } = await supabase.functions.invoke('create-access-request', {
        body: {
          telegramId: validation.data.telegram_id,
          username: validation.data.username,
          firstName: validation.data.first_name,
        },
      });

      if (error) throw error;

      // Send admin notifications
      try {
        await supabase.functions.invoke('notify-admin-new-request', {
          body: {
            telegramId: validation.data.telegram_id,
            username: validation.data.username,
            firstName: validation.data.first_name,
          },
        });
      } catch (notifyError) {
        console.error('Failed to send admin notifications:', notifyError);
      }

      toast.success('Request sent', {
        description: 'Administrator will review your request',
      });
    } catch (error: any) {
      console.error('Error requesting access:', error);
      toast.error('Error', {
        description: error.message || 'Failed to send request',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Access Request</CardTitle>
          <CardDescription>
            You need administrator approval to use this application
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {user && (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Telegram ID:</span>
                <span className="font-medium">{user.id}</span>
              </div>
              {user.username && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Username:</span>
                  <span className="font-medium">@{user.username}</span>
                </div>
              )}
              {user.first_name && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Name:</span>
                  <span className="font-medium">{user.first_name}</span>
                </div>
              )}
            </div>
          )}
          <Button
            onClick={handleRequestAccess}
            disabled={isSubmitting || !user}
            className="w-full"
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Request Access
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
