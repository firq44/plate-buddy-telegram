import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { ArrowLeft, Download, Plus, Loader2, Trash2, Edit, Upload, X } from 'lucide-react';
import { useTelegram } from '@/contexts/TelegramContext';
import { useNavigate } from 'react-router-dom';
import { useUserAccess } from '@/hooks/useUserAccess';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface CarPlate {
  id: string;
  plate_number: string;
  description: string | null;
  color: string | null;
  brand: string | null;
  model: string | null;
  photo_url: string | null;
  added_by_telegram_id: string;
  created_at: string;
  last_attempt_at: string | null;
  attempt_count: number;
}

export default function PlatesList() {
  const { user, webApp } = useTelegram();
  const { status, isAdmin: userIsAdmin } = useUserAccess();
  const navigate = useNavigate();
  const [plates, setPlates] = useState<CarPlate[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [exportingCsv, setExportingCsv] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [selectedPlate, setSelectedPlate] = useState<CarPlate | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editColor, setEditColor] = useState('');
  const [editBrand, setEditBrand] = useState('');
  const [editModel, setEditModel] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPhotoFile, setEditPhotoFile] = useState<File | null>(null);
  const [editPhotoPreview, setEditPhotoPreview] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isIncrementingAttempt, setIsIncrementingAttempt] = useState(false);

  const loadPlates = async () => {
    try {
      const { data, error } = await supabase
        .from('car_plates')
        .select('*')
        .is('deleted_at', null)
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

  useEffect(() => {
    if (status === 'loading') return;
    if (status !== 'approved') {
      navigate('/');
    }
  }, [status, navigate]);

  const handleDeletePlate = async (id: string) => {
    setDeletingIds(prev => new Set(prev).add(id));
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) throw new Error('Not authenticated');

      const telegramId = authUser.user_metadata?.telegram_id;
      if (!telegramId) throw new Error('No Telegram ID found');

      const { error } = await supabase
        .from('car_plates')
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by_telegram_id: telegramId
        })
        .eq('id', id);

      if (error) {
        console.error('Delete error:', error);
        throw error;
      }

      toast.success('Номер удален');
      
      // Явно перезагружаем список после удаления
      await loadPlates();
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

  const filterPlatesByPeriod = (plates: CarPlate[], period: 'all' | 'today' | 'week' | 'month' = selectedPeriod) => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay() + 1); // Понедельник
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    return plates.filter(plate => {
      const plateDate = new Date(plate.created_at);
      switch (period) {
        case 'today':
          return plateDate >= startOfToday;
        case 'week':
          return plateDate >= startOfWeek;
        case 'month':
          return plateDate >= startOfMonth;
        default:
          return true;
      }
    });
  };

  const handleEditPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Photo too large', { description: 'Maximum size is 5MB' });
        return;
      }
      setEditPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleStartEdit = () => {
    if (!selectedPlate) return;
    setEditColor(selectedPlate.color || '');
    setEditBrand(selectedPlate.brand || '');
    setEditModel(selectedPlate.model || '');
    setEditDescription(selectedPlate.description || '');
    setEditPhotoPreview(selectedPlate.photo_url);
    setIsEditMode(true);
  };

  const handleCancelEdit = () => {
    setIsEditMode(false);
    setEditColor('');
    setEditBrand('');
    setEditModel('');
    setEditDescription('');
    setEditPhotoFile(null);
    setEditPhotoPreview(null);
  };

  const handleSaveEdit = async () => {
    if (!selectedPlate || !user) return;
    
    setIsSaving(true);
    try {
      let photoUrl = selectedPlate.photo_url;

      // Upload new photo if provided
      if (editPhotoFile) {
        const fileExt = editPhotoFile.name.split('.').pop();
        const fileName = `${user.id}_${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('car-photos')
          .upload(filePath, editPhotoFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('car-photos')
          .getPublicUrl(filePath);

        photoUrl = publicUrl;

        // Delete old photo if exists
        if (selectedPlate.photo_url) {
          const oldPath = selectedPlate.photo_url.split('/car-photos/')[1];
          if (oldPath) {
            await supabase.storage.from('car-photos').remove([oldPath]);
          }
        }
      } else if (editPhotoPreview === null && selectedPlate.photo_url) {
        // User removed the photo
        const oldPath = selectedPlate.photo_url.split('/car-photos/')[1];
        if (oldPath) {
          await supabase.storage.from('car-photos').remove([oldPath]);
        }
        photoUrl = null;
      }

      const { error } = await supabase
        .from('car_plates')
        .update({
          color: editColor || null,
          brand: editBrand || null,
          model: editModel || null,
          description: editDescription || null,
          photo_url: photoUrl,
        })
        .eq('id', selectedPlate.id);

      if (error) throw error;

      toast.success('Plate updated successfully');
      setIsEditMode(false);
      setEditPhotoFile(null);
      setEditPhotoPreview(null);
      await loadPlates();
      
      // Update selected plate with new data
      const updatedPlate = plates.find(p => p.id === selectedPlate.id);
      if (updatedPlate) {
        setSelectedPlate(updatedPlate);
      }
    } catch (error) {
      console.error('Error updating plate:', error);
      toast.error('Error updating plate');
    } finally {
      setIsSaving(false);
    }
  };

  const handleIncrementAttempt = async () => {
    if (!selectedPlate) return;
    
    setIsIncrementingAttempt(true);
    try {
      const { error } = await supabase
        .from('car_plates')
        .update({
          attempt_count: selectedPlate.attempt_count + 1,
          last_attempt_at: new Date().toISOString(),
        })
        .eq('id', selectedPlate.id);

      if (error) throw error;

      toast.success('Attempt count updated');
      await loadPlates();
      
      // Update selected plate with new data
      const updatedPlate = plates.find(p => p.id === selectedPlate.id);
      if (updatedPlate) {
        setSelectedPlate(updatedPlate);
      }
    } catch (error) {
      console.error('Error incrementing attempt:', error);
      toast.error('Error updating attempt count');
    } finally {
      setIsIncrementingAttempt(false);
    }
  };

  const handleDecrementAttempt = async () => {
    if (!selectedPlate || selectedPlate.attempt_count === 0) return;
    
    setIsIncrementingAttempt(true);
    try {
      const { error } = await supabase
        .from('car_plates')
        .update({
          attempt_count: Math.max(0, selectedPlate.attempt_count - 1),
          last_attempt_at: new Date().toISOString(),
        })
        .eq('id', selectedPlate.id);

      if (error) throw error;

      toast.success('Attempt count updated');
      await loadPlates();
      
      // Update selected plate with new data
      const updatedPlate = plates.find(p => p.id === selectedPlate.id);
      if (updatedPlate) {
        setSelectedPlate(updatedPlate);
      }
    } catch (error) {
      console.error('Error decrementing attempt:', error);
      toast.error('Error updating attempt count');
    } finally {
      setIsIncrementingAttempt(false);
    }
  };

  const handleExportPlates = async () => {
    setExportingCsv(true);
    try {
      // В Telegram Mini App отправляем файл прямо в чат пользователя
      if (webApp && user) {
        const { error: funcError } = await supabase.functions.invoke('export-plates', {
          body: { telegramId: user.id.toString() },
        });

        if (funcError) throw funcError;

        toast.success('Файл отправлен вам в Telegram');
        return;
      }

      const { data, error } = await supabase.rpc('get_plate_export_data');
      
      if (error) throw error;

      const csv = [
        ['Plate Number', 'Telegram ID', 'Username', 'Date Added', 'Last Attempt', 'Attempts', 'Color', 'Brand', 'Model', 'Description'].join(','),
        ...(data || []).map((row: any) => {
          const description = row.description ? `"${row.description.replace(/"/g, '""')}"` : '';
          return [
            row.plate_number,
            row.added_by_telegram_id,
            row.added_by_username || '',
            new Date(row.created_at).toLocaleDateString('en-US'),
            row.last_attempt_at ? new Date(row.last_attempt_at).toLocaleDateString('en-US') : '',
            row.attempt_count || 0,
            row.color || '',
            row.brand || '',
            row.model || '',
            description
          ].join(',');
        })
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
    <SidebarProvider>
      <div className="flex min-h-screen w-full max-w-full overflow-x-hidden bg-gradient-to-br from-background to-muted/20">
        {isAdmin && <AppSidebar isAdmin={userIsAdmin} />}
        <main className="flex-1 p-4 overflow-x-hidden w-full">
          {isAdmin && (
            <div className="fixed top-4 right-4 z-50">
              <SidebarTrigger className="h-12 w-12 bg-card hover:bg-accent shadow-lg" />
            </div>
          )}
          <div className="max-w-7xl mx-auto space-y-4 mt-4">
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
              <Tabs value={selectedPeriod} onValueChange={(v) => setSelectedPeriod(v as any)} className="w-full">
                <TabsList className="grid w-full grid-cols-4 mb-6">
                  <TabsTrigger value="all">All ({plates.length})</TabsTrigger>
                  <TabsTrigger value="today">Today ({filterPlatesByPeriod(plates, 'today').length})</TabsTrigger>
                  <TabsTrigger value="week">Week ({filterPlatesByPeriod(plates, 'week').length})</TabsTrigger>
                  <TabsTrigger value="month">Month ({filterPlatesByPeriod(plates, 'month').length})</TabsTrigger>
                </TabsList>
                
                <TabsContent value={selectedPeriod} className="mt-0">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filterPlatesByPeriod(plates).map((plate) => {
                      const match = plate.plate_number.match(/^([A-Z]{2,3})(.+)$/);
                      const letters = match ? match[1] : '';
                      const numbers = match ? match[2] : '';
                      
                      return (
                        <div
                          key={plate.id}
                          className="p-4 bg-white rounded-lg shadow-sm border border-gray-200"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div 
                              className="flex items-stretch bg-white rounded-lg overflow-hidden shadow-md border-2 border-black cursor-pointer hover:shadow-lg transition-shadow"
                              onClick={() => {
                                setSelectedPlate(plate);
                                setIsDetailsOpen(true);
                              }}
                            >
                              <div className="bg-[#4169E1] text-white px-3 flex flex-col items-center justify-center gap-0.5">
                                <span className="text-base">🇵🇱</span>
                                <span className="text-xs font-bold leading-none">PL</span>
                              </div>
                              <div className="px-3 py-2 bg-[#E8EDF2] flex items-center gap-2">
                                <span className="text-lg font-bold text-black tracking-wider">{letters}</span>
                                <span className="text-lg font-bold text-black tracking-wider">{numbers}</span>
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
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                )}
                              </Button>
                            )}
                          </div>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-600">Added:</span>
                              <span className="text-foreground font-medium">
                                {new Date(plate.created_at).toLocaleString('en-US', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  hour12: false
                                })}
                              </span>
                            </div>
                            {plate.last_attempt_at && (
                              <div className="flex justify-between">
                                <span className="text-gray-600">Last attempt:</span>
                                <span className="text-foreground font-medium">
                                  {new Date(plate.last_attempt_at).toLocaleString('en-US', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    hour12: false
                                  })}
                                </span>
                              </div>
                            )}
                            <div className="flex justify-between">
                              <span className="text-gray-600">Attempts:</span>
                              <span className="text-red-600 font-bold">{plate.attempt_count}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {filterPlatesByPeriod(plates).length === 0 && (
                    <div className="text-center text-muted-foreground py-8">
                      No plates for selected period
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </div>
        </main>

        <Dialog open={isDetailsOpen} onOpenChange={(open) => {
          setIsDetailsOpen(open);
          if (!open) {
            handleCancelEdit();
          }
        }}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <div>
                  <DialogTitle>Vehicle Details</DialogTitle>
                  <DialogDescription>
                    {isEditMode ? 'Edit vehicle information' : 'Additional information about this vehicle'}
                  </DialogDescription>
                </div>
                {selectedPlate && canDeletePlate(selectedPlate) && !isEditMode && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleStartEdit}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                )}
              </div>
            </DialogHeader>
            
            {selectedPlate && (
              <div className="space-y-4">
                <div className="flex justify-center mb-4">
                  <div className="flex items-stretch bg-white rounded-lg overflow-hidden shadow-md border-2 border-black">
                    <div className="bg-[#4169E1] text-white px-4 flex flex-col items-center justify-center gap-0.5">
                      <span className="text-xl">🇵🇱</span>
                      <span className="text-sm font-bold leading-none">PL</span>
                    </div>
                    <div className="px-4 py-3 bg-[#E8EDF2] flex items-center gap-2">
                      <span className="text-2xl font-bold text-black tracking-wider">
                        {selectedPlate.plate_number}
                      </span>
                    </div>
                  </div>
                </div>

                {isEditMode ? (
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="edit-color">Car Color</Label>
                      <Input
                        id="edit-color"
                        placeholder="e.g., Black, White, Red"
                        value={editColor}
                        onChange={(e) => setEditColor(e.target.value)}
                        maxLength={50}
                      />
                    </div>

                    <div>
                      <Label htmlFor="edit-brand">Brand</Label>
                      <Input
                        id="edit-brand"
                        placeholder="e.g., BMW, Toyota, Mercedes"
                        value={editBrand}
                        onChange={(e) => setEditBrand(e.target.value)}
                        maxLength={100}
                      />
                    </div>

                    <div>
                      <Label htmlFor="edit-model">Model</Label>
                      <Input
                        id="edit-model"
                        placeholder="e.g., 3 Series, Camry, E-Class"
                        value={editModel}
                        onChange={(e) => setEditModel(e.target.value)}
                        maxLength={100}
                      />
                    </div>

                    <div>
                      <Label htmlFor="edit-description">Additional Comment</Label>
                      <Textarea
                        id="edit-description"
                        placeholder="Any additional notes about this vehicle..."
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        maxLength={500}
                        rows={4}
                      />
                    </div>

                    <div>
                      <Label htmlFor="edit-photo">Photo</Label>
                      <div className="mt-2">
                        {editPhotoPreview ? (
                          <div className="relative">
                            <img 
                              src={editPhotoPreview} 
                              alt="Preview" 
                              className="w-full h-48 object-cover rounded-lg"
                            />
                            <Button
                              type="button"
                              variant="destructive"
                              size="icon"
                              className="absolute top-2 right-2"
                              onClick={() => {
                                setEditPhotoFile(null);
                                setEditPhotoPreview(null);
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                              <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                              <p className="text-sm text-muted-foreground">Click to upload photo</p>
                              <p className="text-xs text-muted-foreground">Max 5MB</p>
                            </div>
                            <input
                              id="edit-photo"
                              type="file"
                              className="hidden"
                              accept="image/*"
                              onChange={handleEditPhotoChange}
                            />
                          </label>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2 pt-4">
                      <Button
                        onClick={handleSaveEdit}
                        disabled={isSaving}
                        className="flex-1 bg-[#0052CC] hover:bg-[#0747A6] text-white"
                      >
                        {isSaving ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          'Save Changes'
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={handleCancelEdit}
                        disabled={isSaving}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    {selectedPlate.photo_url && (
                      <div className="mb-4">
                        <img 
                          src={selectedPlate.photo_url} 
                          alt="Vehicle" 
                          className="w-full h-64 object-cover rounded-lg"
                        />
                      </div>
                    )}

                    <div className="space-y-3">
                      {selectedPlate.color && (
                        <div className="border-b pb-2">
                          <span className="text-sm text-muted-foreground">Color:</span>
                          <p className="text-base font-medium">{selectedPlate.color}</p>
                        </div>
                      )}
                      
                      {selectedPlate.brand && (
                        <div className="border-b pb-2">
                          <span className="text-sm text-muted-foreground">Brand:</span>
                          <p className="text-base font-medium">{selectedPlate.brand}</p>
                        </div>
                      )}
                      
                      {selectedPlate.model && (
                        <div className="border-b pb-2">
                          <span className="text-sm text-muted-foreground">Model:</span>
                          <p className="text-base font-medium">{selectedPlate.model}</p>
                        </div>
                      )}
                      
                      {selectedPlate.description && (
                        <div className="border-b pb-2">
                          <span className="text-sm text-muted-foreground">Additional Notes:</span>
                          <p className="text-base">{selectedPlate.description}</p>
                        </div>
                      )}

                      {!selectedPlate.color && !selectedPlate.brand && !selectedPlate.model && !selectedPlate.description && !selectedPlate.photo_url && (
                        <div className="text-center py-4 text-muted-foreground">
                          No additional details available for this vehicle
                        </div>
                      )}
                    </div>

                    <div className="mt-4 pt-4 border-t space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Added:</span>
                        <span className="font-medium">
                          {new Date(selectedPlate.created_at).toLocaleString('en-US', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: false
                          })}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Attempts:</span>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleDecrementAttempt}
                            disabled={isIncrementingAttempt || selectedPlate.attempt_count === 0}
                            className="h-7 px-2 text-xs"
                          >
                            {isIncrementingAttempt ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              '-1'
                            )}
                          </Button>
                          <span className="font-bold text-red-600 min-w-[20px] text-center">{selectedPlate.attempt_count}</span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleIncrementAttempt}
                            disabled={isIncrementingAttempt}
                            className="h-7 px-2 text-xs"
                          >
                            {isIncrementingAttempt ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              '+1'
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </SidebarProvider>
  );
}
