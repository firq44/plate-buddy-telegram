import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { X, Loader2, UserPlus, Shield, Users, Download } from 'lucide-react';
import { useTelegram } from '@/contexts/TelegramContext';
import { useNavigate } from 'react-router-dom';
import { useUserAccess } from '@/hooks/useUserAccess';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';

interface User {
  id: string;
  telegram_id: string;
  username: string | null;
  first_name: string | null;
  user_roles: { role: 'admin' | 'user' }[];
}

interface AccessRequest {
  id: string;
  telegram_id: string;
  username: string | null;
  first_name: string | null;
  created_at: string;
  status: string;
}

export default function Admin() {
  const { user: telegramUser } = useTelegram();
  const { isAdmin } = useUserAccess();
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);
  const [telegramId, setTelegramId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);

  useEffect(() => {
    const checkAdminAccess = async () => {
      if (!telegramUser) {
        navigate('/');
        return;
      }

      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('telegram_id', telegramUser.id.toString())
        .maybeSingle();

      if (!userData) {
        navigate('/');
        return;
      }

      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userData.id)
        .eq('role', 'admin')
        .maybeSingle();

      if (!roleData) {
        navigate('/checker');
        return;
      }

      setIsAuthorized(true);
    };

    checkAdminAccess();
  }, [telegramUser, navigate]);

  const loadData = async () => {
    try {
      const { data: usersData } = await supabase
        .from('users')
        .select('id, telegram_id, username, first_name')
        .order('created_at', { ascending: false });

      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('user_id, role');

      const usersWithRoles = (usersData || []).map(user => ({
        ...user,
        user_roles: (rolesData || [])
          .filter(r => r.user_id === user.id)
          .map(r => ({ role: r.role as 'admin' | 'user' }))
      }));

      const { data: requestsData } = await supabase
        .from('access_requests')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (usersWithRoles) setUsers(usersWithRoles);
      if (requestsData) setAccessRequests(requestsData);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  useEffect(() => {
    if (isAuthorized) {
      loadData();

      const channel = supabase
        .channel('admin-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, loadData)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'user_roles' }, loadData)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'access_requests' }, loadData)
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [isAuthorized]);

  const handleAddUser = async (role: 'admin' | 'user' = 'user') => {
    if (!telegramId.trim()) {
      toast.error('Введите Telegram ID');
      return;
    }

    setIsLoading(true);
    try {
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('telegram_id', telegramId.trim())
        .maybeSingle();

      let userId: string;

      if (existingUser) {
        userId = existingUser.id;
        toast.info('Пользователь уже существует, обновляем роль');
      } else {
        const { data: userData, error: userError } = await supabase
          .from('users')
          .insert({
            telegram_id: telegramId.trim(),
            username: null,
            first_name: null,
          })
          .select()
          .single();

        if (userError) throw userError;
        userId = userData.id;
      }

      const { data: existingRole } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', userId)
        .eq('role', role)
        .maybeSingle();

      if (!existingRole) {
        const { error: roleError } = await supabase
          .from('user_roles')
          .insert({
            user_id: userId,
            role: role,
          });

        if (roleError) throw roleError;
      }

      await supabase
        .from('access_requests')
        .update({ status: 'approved' })
        .eq('telegram_id', telegramId.trim())
        .eq('status', 'pending');

      toast.success(role === 'admin' ? 'Админ добавлен' : 'Пользователь добавлен');
      setTelegramId('');
      loadData();
    } catch (error: any) {
      console.error('Error adding user:', error);
      toast.error(error.message || 'Ошибка при добавлении пользователя');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApproveRequest = async (requestId: string, telegramIdToApprove: string) => {
    try {
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('telegram_id', telegramIdToApprove)
        .maybeSingle();

      let userId: string;

      if (!existingUser) {
        const request = accessRequests.find(r => r.id === requestId);
        const { data: userData, error: userError } = await supabase
          .from('users')
          .insert({
            telegram_id: telegramIdToApprove,
            username: request?.username || null,
            first_name: request?.first_name || null,
          })
          .select()
          .single();

        if (userError) throw userError;
        userId = userData.id;
      } else {
        userId = existingUser.id;
      }

      const { data: existingRole } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', userId)
        .eq('role', 'user')
        .maybeSingle();

      if (!existingRole) {
        await supabase
          .from('user_roles')
          .insert({
            user_id: userId,
            role: 'user',
          });
      }

      const { error } = await supabase
        .from('access_requests')
        .update({ status: 'approved' })
        .eq('id', requestId);

      if (error) throw error;

      toast.success('Запрос одобрен');
      loadData();
    } catch (error: any) {
      console.error('Error approving request:', error);
      toast.error(error.message || 'Ошибка при одобрении запроса');
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from('access_requests')
        .update({ status: 'rejected' })
        .eq('id', requestId);

      if (error) throw error;

      toast.success('Запрос отклонен');
      loadData();
    } catch (error: any) {
      console.error('Error rejecting request:', error);
      toast.error(error.message || 'Ошибка при отклонении запроса');
    }
  };

  const handleRemoveUser = async (userId: string, telegramIdToRemove: string) => {
    if (telegramIdToRemove === '785921635') {
      toast.error('Невозможно удалить супер админа');
      return;
    }

    try {
      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', userId);

      if (error) throw error;

      toast.success('Пользователь удален');
      loadData();
    } catch (error: any) {
      console.error('Error removing user:', error);
      toast.error(error.message || 'Ошибка при удалении пользователя');
    }
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

  if (!isAuthorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full max-w-full overflow-x-hidden bg-gradient-to-br from-background to-muted/20">
        <AppSidebar isAdmin={isAdmin} />
        <main className="flex-1 p-4 overflow-x-hidden w-full">
          <div className="fixed top-4 right-4 z-50">
            <SidebarTrigger className="h-12 w-12 bg-card hover:bg-accent shadow-lg" />
          </div>
          <div className="max-w-7xl mx-auto space-y-6 mt-16">
            <div className="flex items-center justify-between">
              <h1 className="text-3xl font-bold text-foreground">Админ Панель</h1>
              <Button variant="outline" onClick={() => navigate('/checker')}>
                Назад
              </Button>
            </div>

            {accessRequests.length > 0 && (
              <Card className="p-6">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Shield className="h-5 w-5 text-accent" />
                  Запросы на доступ ({accessRequests.length})
                </h2>
                <div className="space-y-3">
                  {accessRequests.map((request) => (
                    <div
                      key={request.id}
                      className="flex items-center justify-between p-4 bg-secondary rounded-lg"
                    >
                      <div>
                        <div className="font-semibold text-foreground">
                          {request.first_name || request.username || 'Без имени'}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          ID: {request.telegram_id}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(request.created_at).toLocaleString('ru-RU')}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleApproveRequest(request.id, request.telegram_id)}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          Одобрить
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleRejectRequest(request.id)}
                        >
                          Отклонить
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            <Card className="p-6">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-accent" />
                Добавить пользователя
              </h2>
              <div className="flex gap-2">
                <Input
                  placeholder="Telegram ID"
                  value={telegramId}
                  onChange={(e) => setTelegramId(e.target.value)}
                  className="flex-1"
                />
                <Button
                  onClick={() => handleAddUser('user')}
                  disabled={isLoading || !telegramId.trim()}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Добавить User'
                  )}
                </Button>
                <Button
                  onClick={() => handleAddUser('admin')}
                  disabled={isLoading || !telegramId.trim()}
                  variant="secondary"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Добавить Admin'
                  )}
                </Button>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Users className="h-5 w-5 text-accent" />
                  Пользователи ({users.length})
                </h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportPlates}
                  disabled={exportingCsv}
                >
                  {exportingCsv ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  Экспорт CSV
                </Button>
              </div>
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {users.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-4 bg-secondary rounded-lg"
                  >
                    <div>
                      <div className="font-semibold text-foreground flex items-center gap-2">
                        {user.first_name || user.username || 'Без имени'}
                        {user.user_roles.some(r => r.role === 'admin') && (
                          <span className="text-xs bg-accent text-accent-foreground px-2 py-0.5 rounded">
                            ADMIN
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        ID: {user.telegram_id}
                      </div>
                      {user.username && (
                        <div className="text-xs text-muted-foreground">
                          @{user.username}
                        </div>
                      )}
                    </div>
                    {user.telegram_id !== '785921635' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveUser(user.id, user.telegram_id)}
                        className="hover:bg-destructive/10 hover:text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                {users.length === 0 && (
                  <div className="text-center text-muted-foreground py-8">
                    Нет пользователей
                  </div>
                )}
              </div>
            </Card>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
