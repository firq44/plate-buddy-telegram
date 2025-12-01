import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { List, Loader2, Upload, X } from 'lucide-react';
import { useTelegram } from '@/contexts/TelegramContext';
import { useNavigate } from 'react-router-dom';
import { plateSchema } from '@/lib/validation';
import { PlateInput } from '@/components/PlateInput';
import { useUserAccess } from '@/hooks/useUserAccess';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
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
}

export default function CarChecker() {
  const { user } = useTelegram();
  const { status, isAdmin } = useUserAccess();
  const navigate = useNavigate();
  const [plates, setPlates] = useState<CarPlate[]>([]);
  const [newPlate, setNewPlate] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [carColor, setCarColor] = useState('');
  const [carBrand, setCarBrand] = useState('');
  const [carModel, setCarModel] = useState('');
  const [carDescription, setCarDescription] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

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

  const handleOpenSheet = () => {
    if (!newPlate.trim()) return;

    const plateNumber = newPlate.trim().toUpperCase().replace(/\s/g, '');
    const validation = plateSchema.safeParse({ plate_number: plateNumber });
    
    if (!validation.success) {
      toast.error('Validation Error', {
        description: validation.error.issues[0].message,
      });
      return;
    }

    setIsSheetOpen(true);
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Photo too large', { description: 'Maximum size is 5MB' });
        return;
      }
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddPlate = async () => {
    if (!newPlate.trim() || !user) return;

    const plateNumber = newPlate.trim().toUpperCase().replace(/\s/g, '');

    setIsLoading(true);

    try {
      let photoUrl: string | null = null;

      // Upload photo if provided
      if (photoFile) {
        const fileExt = photoFile.name.split('.').pop();
        const fileName = `${user.id}_${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('car-photos')
          .upload(filePath, photoFile);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('car-photos')
          .getPublicUrl(filePath);

        photoUrl = publicUrl;
      }

      const validation = plateSchema.safeParse({ 
        plate_number: plateNumber,
        color: carColor,
        brand: carBrand,
        model: carModel,
        description: carDescription,
        photo_url: photoUrl
      });
      
      if (!validation.success) {
        toast.error('Validation Error', {
          description: validation.error.issues[0].message,
        });
        return;
      }

      try {
      const { data: existing } = await supabase
        .from('car_plates')
        .select('id, last_attempt_at, attempt_count, created_at')
        .eq('plate_number', plateNumber)
        .is('deleted_at', null)
        .maybeSingle();

      if (existing) {
        const now = new Date();
        const newAttemptCount = (existing.attempt_count || 0) + 1;
        
        await supabase.from('plate_addition_attempts').insert({
          plate_number: plateNumber,
          attempted_by_telegram_id: user.id.toString(),
          success: false,
        });

        await supabase
          .from('car_plates')
          .update({
            last_attempt_at: now.toISOString(),
            attempt_count: newAttemptCount,
          })
          .eq('id', existing.id);

        const addedDateTime = new Date(existing.created_at).toLocaleString('en-US', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        const lastAttemptDateTime = now.toLocaleString('en-US', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        
        toast.error('Plate Already Added', {
          description: `Added: ${addedDateTime}\nAttempts: ${newAttemptCount}\nLast attempt: ${lastAttemptDateTime}`,
          duration: 5000,
        });
        setIsSheetOpen(false);
        setNewPlate('');
        setCarColor('');
        setCarBrand('');
        setCarModel('');
        setCarDescription('');
        setIsLoading(false);
        return;
      }

        const { error: insertError } = await supabase
          .from('car_plates')
          .insert({
            plate_number: plateNumber,
            added_by_telegram_id: user.id.toString(),
            color: carColor || null,
            brand: carBrand || null,
            model: carModel || null,
            description: carDescription || null,
            photo_url: photoUrl,
          });

        if (insertError) throw insertError;

        await supabase.from('plate_addition_attempts').insert({
          plate_number: plateNumber,
          attempted_by_telegram_id: user.id.toString(),
          success: true,
        });

        toast.success('Plate Added Successfully');
        setIsSheetOpen(false);
        setNewPlate('');
        setCarColor('');
        setCarBrand('');
        setCarModel('');
        setCarDescription('');
        setPhotoFile(null);
        setPhotoPreview(null);
      } catch (error) {
        console.error('Error adding plate:', error);
        toast.error('Error Adding Plate');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error Adding Plate');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full max-w-full overflow-x-hidden bg-gradient-to-br from-background to-muted/20">
        {isAdmin && <AppSidebar isAdmin={isAdmin} />}
        <main className="flex-1 flex flex-col items-center justify-center p-4 overflow-x-hidden w-full">
          {isAdmin && (
            <div className="fixed top-4 right-4 z-50">
              <SidebarTrigger className="h-12 w-12 bg-card hover:bg-accent shadow-lg" />
            </div>
          )}
          <div className="w-full max-w-lg px-2">
            <div className="text-center mb-8">
              <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-2">
                Plate Registry 🇵🇱
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground">Enter a Polish license plate number</p>
            </div>

            <Card className="p-4 sm:p-6 shadow-lg border-0">
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
                  onClick={handleOpenSheet}
                  disabled={!newPlate.trim()}
                  className={`w-full h-12 text-base font-medium text-white transition-colors ${
                    newPlate.trim() 
                      ? 'bg-[#0052CC] hover:bg-[#0747A6]' 
                      : 'bg-[#B3D4F5] cursor-not-allowed'
                  }`}
                >
                  Add Plate
                </Button>

                <Button
                  onClick={() => navigate('/plates')}
                  variant="outline"
                  className="w-full h-12 text-base font-medium bg-[#E8EDF2] hover:bg-[#D8E0E8] text-foreground border-0"
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
        </main>

        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
          <SheetContent side="bottom" className="h-[90vh] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Add Car Details</SheetTitle>
              <SheetDescription>
                Enter additional information about the vehicle (optional)
              </SheetDescription>
            </SheetHeader>
            
            <div className="space-y-4 mt-6">
              <div>
                <Label htmlFor="color">Car Color</Label>
                <Input
                  id="color"
                  placeholder="e.g., Black, White, Red"
                  value={carColor}
                  onChange={(e) => setCarColor(e.target.value)}
                  maxLength={50}
                />
              </div>

              <div>
                <Label htmlFor="brand">Brand</Label>
                <Input
                  id="brand"
                  placeholder="e.g., BMW, Toyota, Mercedes"
                  value={carBrand}
                  onChange={(e) => setCarBrand(e.target.value)}
                  maxLength={100}
                />
              </div>

              <div>
                <Label htmlFor="model">Model</Label>
                <Input
                  id="model"
                  placeholder="e.g., 3 Series, Camry, E-Class"
                  value={carModel}
                  onChange={(e) => setCarModel(e.target.value)}
                  maxLength={100}
                />
              </div>

              <div>
                <Label htmlFor="description">Additional Comment</Label>
                <Textarea
                  id="description"
                  placeholder="Any additional notes about this vehicle..."
                  value={carDescription}
                  onChange={(e) => setCarDescription(e.target.value)}
                  maxLength={500}
                  rows={4}
                />
              </div>

              <div>
                <Label htmlFor="photo">Photo (optional)</Label>
                <div className="mt-2">
                  {photoPreview ? (
                    <div className="relative">
                      <img 
                        src={photoPreview} 
                        alt="Preview" 
                        className="w-full h-48 object-cover rounded-lg"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2"
                        onClick={() => {
                          setPhotoFile(null);
                          setPhotoPreview(null);
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
                        id="photo"
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={handlePhotoChange}
                      />
                    </label>
                  )}
                </div>
              </div>

              <Button
                onClick={handleAddPlate}
                disabled={isLoading}
                className="w-full h-12 bg-[#0052CC] hover:bg-[#0747A6] text-white"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Adding...
                  </>
                ) : (
                  'Save Plate'
                )}
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </SidebarProvider>
  );
}
