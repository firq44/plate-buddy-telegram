import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { XCircle } from 'lucide-react';

export const RejectedRequest = () => {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-destructive">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <XCircle className="h-5 w-5" />
            Запрос отклонен
          </CardTitle>
          <CardDescription>
            Ваш запрос на доступ был отклонен администратором
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            Для получения дополнительной информации свяжитесь с администратором
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
