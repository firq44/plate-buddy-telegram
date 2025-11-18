import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { ArrowLeft, Download, Plus, Loader2, Trash2 } from 'lucide-react';
import { useTelegram } from '@/contexts/TelegramContext';
import { useNavigate } from 'react-router-dom';

interface CarPlate {
  id: string;
  plate_number: string;
  description: string | null;
  added_by_telegram_id: string;
  created_at: string;
}

export default function PlatesList() {
  const { user } = useTelegram();
  const navigate = useNavigate();
  const [plates, setPlates] = useState<CarPlate[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [exportingCsv, setExportingCsv] = useState(false);

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

  const handleDeletePlate = async (id: string) => {
    setDeletingIds(prev => new Set(prev).add(id));
    try {
      const { error } = await supabase
        .from('car_plates')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Номер удален');
    } catch (error) {
      console.error('Error deleting plate:', error);
      toast.error('Ошибка при удалении номера');
    } finally {
      setDeletingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
  };

  const canDeletePlate = (plate: CarPlate) => {
    return isAdmin || plate.added_by_telegram_id === user?.id.toString();
  };

  const handleExportPlates = async () => {
    setExportingCsv(true);
    try {
      const { data, error } = await supabase.rpc('get_plate_export_data');
      
      if (error) throw error;

      const csv = [
        ['Номер', 'Telegram ID', 'Username', 'Дата добавления', 'Последняя попытка', 'Попыток'].join(','),
        ...(data || []).map((row: any) => [
          row.plate_number,
          row.added_by_telegram_id,
          row.added_by_username || '',
          new Date(row.created_at).toLocaleDateString('ru-RU'),
          row.last_attempt_at ? new Date(row.last_attempt_at).toLocaleDateString('ru-RU') : '',
          row.attempt_count || 0
        ].join(','))
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `plates_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      
      toast.success('CSV экспортирован');
    } catch (error) {
      console.error('Error exporting:', error);
      toast.error('Ошибка экспорта');
    } finally {
      setExportingCsv(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto p-6">
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/checker')}
              className="hover:bg-secondary"
            >
              <ArrowLeft className="h-6 w-6" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Saved Plates</h1>
              <p className="text-muted-foreground">All saved license plates</p>
            </div>
          </div>
        </div>

        <div className="flex gap-3 mb-6">
          <Button
            variant="outline"
            onClick={handleExportPlates}
            disabled={exportingCsv}
            className="bg-white hover:bg-gray-50"
          >
            {exportingCsv ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Export to Excel
          </Button>
          <Button
            onClick={() => navigate('/checker')}
            className="bg-[#0052CC] hover:bg-[#0747A6] text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add New
          </Button>
        </div>

        {plates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="text-6xl mb-4">🚗</div>
            <h2 className="text-2xl font-bold text-foreground mb-2">No saved plates</h2>
            <p className="text-muted-foreground mb-6">Add your first license plate</p>
            <Button
              onClick={() => navigate('/checker')}
              className="bg-[#0052CC] hover:bg-[#0747A6] text-white"
            >
              Add Plate
            </Button>
          </div>
        ) : (
          <div className="grid gap-3">
            {plates.map((plate) => (
              <div
                key={plate.id}
                className="flex items-center justify-between p-4 bg-white rounded-lg shadow-sm border border-gray-200"
              >
                <div>
                  <div className="font-mono font-bold text-xl text-foreground">
                    {plate.plate_number}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Added {new Date(plate.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </div>
                </div>
                {canDeletePlate(plate) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeletePlate(plate.id)}
                    disabled={deletingIds.has(plate.id)}
                    className="hover:bg-red-50 hover:text-red-600"
                  >
                    {deletingIds.has(plate.id) ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
