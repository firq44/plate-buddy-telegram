import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock } from 'lucide-react';

export const PendingRequest = () => {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-accent" />
            Запрос на рассмотрении
          </CardTitle>
          <CardDescription>
            Ваш запрос отправлен администратору. Ожидайте одобрения.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            Вы получите доступ после одобрения администратором
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
