import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { List, Loader2, MoreVertical, X } from 'lucide-react';
import { useTelegram } from '@/contexts/TelegramContext';
import { useNavigate } from 'react-router-dom';
import { plateSchema } from '@/lib/validation';
import { PlateInput } from '@/components/PlateInput';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

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

      // Check if user has admin role in user_roles table
      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('telegram_id', user.id.toString())
        .maybeSingle();

      if (!userData) return;

      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userData.id)
        .eq('role', 'admin')
        .maybeSingle();

      setIsAdmin(!!roleData);
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

    const plateNumber = newPlate.trim().toUpperCase().replace(/\s/g, '');

    const validation = plateSchema.safeParse({ plate_number: plateNumber });
    if (!validation.success) {
      toast.error('Ошибка валидации', {
        description: validation.error.issues[0].message,
      });
      return;
    }

    setIsLoading(true);

    try {
      const { data: existing } = await supabase
        .from('car_plates')
        .select('id, last_attempt_at, attempt_count')
        .eq('plate_number', plateNumber)
        .maybeSingle();

      if (existing) {
        await supabase.from('plate_addition_attempts').insert({
          plate_number: plateNumber,
          attempted_by_telegram_id: user.id.toString(),
          success: false,
        });

        await supabase
          .from('car_plates')
          .update({
            last_attempt_at: new Date().toISOString(),
            attempt_count: (existing.attempt_count || 0) + 1,
          })
          .eq('id', existing.id);

        toast.error('Номер уже существует', {
          description: 'Этот номер уже добавлен в базу',
        });
        setNewPlate('');
        setIsLoading(false);
        return;
      }

      const { error: insertError } = await supabase
        .from('car_plates')
        .insert({
          plate_number: plateNumber,
          added_by_telegram_id: user.id.toString(),
        });

      if (insertError) throw insertError;

      await supabase.from('plate_addition_attempts').insert({
        plate_number: plateNumber,
        attempted_by_telegram_id: user.id.toString(),
        success: true,
      });

      toast.success('Номер добавлен');
      setNewPlate('');
    } catch (error) {
      console.error('Error adding plate:', error);
      toast.error('Ошибка при добавлении номера');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Dark Header */}
      <div className="bg-[#2C3E50] text-white px-4 py-3 flex items-center justify-between">
        <h2 className="text-xl font-semibold">Winchester</h2>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="text-white hover:bg-white/10">
                  <MoreVertical className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => navigate('/admin')}>
                  Admin Panel
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-white hover:bg-white/10"
            onClick={() => window.Telegram?.WebApp?.close()}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-lg">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-foreground mb-2">
              Plate Registry 🇵🇱
            </h1>
            <p className="text-muted-foreground">Enter a Polish license plate number</p>
          </div>

          <Card className="p-6 shadow-lg border-0">
            <div className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground mb-2 block">
                  License Plate Number
                </label>
                <PlateInput
                  value={newPlate}
                  onChange={setNewPlate}
                  placeholder="SS 4657C"
                />
              </div>

              <Button
                onClick={handleAddPlate}
                disabled={isLoading || !newPlate.trim()}
                className="w-full h-12 text-base font-medium bg-[#7FA8DA] hover:bg-[#6B94C4] text-white"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Adding...
                  </>
                ) : (
                  'Add Plate'
                )}
              </Button>

              <Button
                onClick={() => navigate('/plates')}
                variant="outline"
                className="w-full h-12 text-base font-medium bg-[#E8EDF2] hover:bg-[#D8E0E8] text-foreground"
              >
                <List className="mr-2 h-5 w-5" />
                View Saved Plates
              </Button>
            </div>

            <div className="mt-4 text-xs text-muted-foreground">
              <strong>How to use:</strong> Enter 2-3 letters, then numbers and optionally a final letter (e.g., SR 4657C)
            </div>
          </Card>
        </div>
      </div>

      {/* Dark Footer */}
      <div className="bg-[#2C3E50] text-white text-center py-4">
        <p className="text-sm">@carplatespl_bot</p>
      </div>
    </div>
  );
}
