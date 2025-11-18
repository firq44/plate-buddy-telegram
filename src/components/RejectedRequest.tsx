import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const RejectedRequest = () => {
  const navigate = useNavigate();
  
  const handleTryAgain = () => {
    navigate('/');
    window.location.reload();
  };
  
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
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Вы можете подать новый запрос на доступ
          </div>
          <Button 
            onClick={handleTryAgain}
            className="w-full"
          >
            Подать запрос снова
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
