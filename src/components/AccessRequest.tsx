import { useState } from 'react';
import { useTelegram } from '@/contexts/TelegramContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

export const AccessRequest = () => {
  const { user } = useTelegram();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRequestAccess = async () => {
    if (!user) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('access_requests')
        .insert({
          telegram_id: user.id.toString(),
          username: user.username,
          first_name: user.first_name,
        });

      if (error) throw error;

      toast.success('Запрос отправлен', {
        description: 'Администратор рассмотрит ваш запрос',
      });
    } catch (error: any) {
      console.error('Error requesting access:', error);
      toast.error('Ошибка', {
        description: error.message || 'Не удалось отправить запрос',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Запрос доступа</CardTitle>
          <CardDescription>
            Для использования приложения необходимо получить доступ от администратора
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
                  <span className="text-muted-foreground">Имя:</span>
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
            Запросить доступ
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
