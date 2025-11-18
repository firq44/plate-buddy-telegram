import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { Search, Plus, Settings, Loader2 } from 'lucide-react';
import { useTelegram } from '@/contexts/TelegramContext';
import { useNavigate } from 'react-router-dom';
import { isMainAdmin } from '@/lib/constants';

interface CarPlate {
  id: string;
  plate_number: string;
  description: string | null;
  added_by_telegram_id: string;
  created_at: string;
}

export default function CarChecker() {
  const { user } = useTelegram();
  const navigate = useNavigate();
  const [plates, setPlates] = useState<CarPlate[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [newPlate, setNewPlate] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const loadPlates = async () => {
    try {
      const { data, error } = await supabase
        .from('car_plates')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) setPlates(data);
    } catch (error) {
      console.error('Error loading plates:', error);
    }
  };

  useEffect(() => {
    const checkAdmin = async () => {
      if (!user) return;

      // Check if main admin
      if (isMainAdmin(user.id)) {
        setIsAdmin(true);
        return;
      }

      // Check in database
      const { data } = await supabase
        .from('users')
        .select('role')
        .eq('telegram_id', user.id.toString())
        .maybeSingle();

      setIsAdmin(data?.role === 'admin');
    };

    checkAdmin();
    loadPlates();

    const channel = supabase
      .channel('car-plates-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'car_plates' }, loadPlates)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const handleAddPlate = async () => {
    if (!newPlate.trim() || !user) return;

    setIsLoading(true);
    try {
      const { error } = await supabase.from('car_plates').insert({
        plate_number: newPlate.trim().toUpperCase(),
        added_by_telegram_id: user.id.toString(),
      });

      if (error) throw error;

      toast.success('Номер добавлен');
      setNewPlate('');
    } catch (error: any) {
      toast.error(error.message || 'Ошибка добавления');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredPlates = plates.filter((plate) =>
    plate.plate_number.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isPlateInList = (query: string) => {
    return plates.some((plate) => plate.plate_number.toLowerCase() === query.toLowerCase());
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">carNumCheck</h1>
          {isAdmin && (
            <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
              <Settings className="h-5 w-5" />
            </Button>
          )}
        </div>

        <Card className="p-4 space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Поиск номера..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {searchQuery && (
            <div className={`text-center p-4 rounded-lg ${
              isPlateInList(searchQuery)
                ? 'bg-destructive/20 text-destructive'
                : 'bg-green-500/20 text-green-400'
            }`}>
              {isPlateInList(searchQuery) ? (
                <div className="font-bold">⚠️ НОМЕР В СПИСКЕ</div>
              ) : (
                <div className="font-bold">✓ Номер чист</div>
              )}
            </div>
          )}
        </Card>

        <Card className="p-4 space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Добавить новый номер"
              value={newPlate}
              onChange={(e) => setNewPlate(e.target.value.toUpperCase())}
              onKeyPress={(e) => e.key === 'Enter' && handleAddPlate()}
            />
            <Button onClick={handleAddPlate} disabled={isLoading || !newPlate.trim()}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </Button>
          </div>
        </Card>

        <div>
          <h2 className="text-lg font-bold mb-3">
            Список номеров ({filteredPlates.length})
          </h2>
          <div className="space-y-2">
            {filteredPlates.map((plate) => (
              <Card key={plate.id} className="p-4">
                <div className="font-mono font-bold text-lg">{plate.plate_number}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(plate.created_at).toLocaleDateString('ru-RU')}
                </div>
              </Card>
            ))}
            {filteredPlates.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                {searchQuery ? 'Ничего не найдено' : 'Список пуст'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
