import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { X, Search, Loader2, Download, ChevronUp, ChevronDown } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTelegram } from '@/contexts/TelegramContext';
import { userSchema } from '@/lib/validation';

interface User {
  id: string;
  telegram_id: string;
  username: string | null;
  role: 'admin' | 'user';
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
  const [users, setUsers] = useState<User[]>([]);
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);
  const [telegramId, setTelegramId] = useState('');
  const [username, setUsername] = useState('');
  const [role, setRole] = useState<'user' | 'admin'>('user');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);

  const loadData = async () => {
    try {
      const { data: usersData } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      const { data: requestsData } = await supabase
        .from('access_requests')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (usersData) setUsers(usersData);
      if (requestsData) setAccessRequests(requestsData);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  useEffect(() => {
    loadData();

    const channel = supabase
      .channel('admin-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, loadData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'access_requests' }, loadData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleAddUser = async () => {
    if (!telegramId.trim()) {
      toast.error('Введите Telegram ID');
      return;
    }

    // Validate input
    const validation = userSchema.safeParse({
      telegram_id: telegramId.trim(),
      username: username.trim() || undefined,
    });

    if (!validation.success) {
      toast.error('Ошибка валидации', {
        description: validation.error.issues[0].message,
      });
      return;
    }

    setIsLoading(true);
    try {
      // Insert into users table
      const { data: userData, error: userError } = await supabase
        .from('users')
        .insert({
          telegram_id: validation.data.telegram_id,
          username: validation.data.username || null,
        })
        .select()
        .single();

      if (userError) throw userError;

      // Insert role into user_roles table
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: userData.id,
          role: role,
        });

      if (roleError) throw roleError;

      toast.success('Пользователь добавлен');
      setTelegramId('');
      setUsername('');
      setRole('user');
    } catch (error: any) {
      toast.error(error.message || 'Ошибка добавления');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      const { error } = await supabase.from('users').delete().eq('id', userId);
      if (error) throw error;
      toast.success('Пользователь удален');
    } catch (error: any) {
      toast.error(error.message || 'Ошибка удаления');
    }
  };

  const handlePromoteUser = async (userId: string, currentRole: 'user' | 'admin') => {
    const newRole = currentRole === 'user' ? 'admin' : 'user';
    try {
      if (newRole === 'admin') {
        // Add admin role
        const { error } = await supabase
          .from('user_roles')
          .insert({
            user_id: userId,
            role: 'admin',
          });
        if (error) throw error;
      } else {
        // Remove admin role
        const { error } = await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', userId)
          .eq('role', 'admin');
        if (error) throw error;
      }
      
      toast.success(newRole === 'admin' ? 'Пользователь повышен до админа' : 'Админ понижен до пользователя');
    } catch (error: any) {
      toast.error(error.message || 'Ошибка изменения роли');
    }
  };

  const handleExportCsv = async () => {
    setExportingCsv(true);
    try {
      const { data, error } = await supabase.rpc('get_plate_export_data');

      if (error) throw error;

      if (!data || data.length === 0) {
        toast.error('Нет данных для экспорта');
        return;
      }

      // Create CSV content
      const headers = [
        'Номер',
        'Добавил (ID)',
        'Username',
        'Дата добавления',
        'Последняя попытка',
        'Попыток добавить',
      ];

      const csvContent = [
        headers.join(','),
        ...data.map((row: any) =>
          [
            row.plate_number,
            row.added_by_telegram_id,
            row.added_by_username || 'N/A',
            new Date(row.created_at).toLocaleString('ru-RU'),
            row.last_attempt_at ? new Date(row.last_attempt_at).toLocaleString('ru-RU') : 'N/A',
            row.attempt_count,
          ].join(',')
        ),
      ].join('\n');

      // Create and download file
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `car_plates_export_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();

      toast.success('CSV файл скачан');
    } catch (error: any) {
      console.error('Export error:', error);
      toast.error(error.message || 'Ошибка экспорта');
    } finally {
      setExportingCsv(false);
    }
  };

  const handleApproveRequest = async (request: AccessRequest) => {
    try {
      // Add user
      const { data: userData, error: userError } = await supabase
        .from('users')
        .insert({
          telegram_id: request.telegram_id,
          username: request.username,
          first_name: request.first_name,
        })
        .select()
        .single();

      if (userError) throw userError;

      // Add user role (default to 'user')
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: userData.id,
          role: 'user',
        });

      if (roleError) throw roleError;

      // Update request status
      const { error: requestError } = await supabase
        .from('access_requests')
        .update({ status: 'approved' })
        .eq('id', request.id);

      if (requestError) throw requestError;

      toast.success('Запрос одобрен');
    } catch (error: any) {
      toast.error(error.message || 'Ошибка одобрения');
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
    } catch (error: any) {
      toast.error(error.message || 'Ошибка отклонения');
    }
  };

  const filteredUsers = users.filter(
    (user) =>
      user.telegram_id.includes(searchQuery) ||
      user.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const admins = filteredUsers.filter((u) => u.role === 'admin');
  const regularUsers = filteredUsers.filter((u) => u.role === 'user');

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Админ-панель</h1>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExportCsv}
              disabled={exportingCsv}
            >
              {exportingCsv ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Экспорт CSV
            </Button>
            <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <Card className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              placeholder="Telegram ID"
              value={telegramId}
              onChange={(e) => setTelegramId(e.target.value)}
            />
            <Input
              placeholder="@username (опц.)"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div className="flex gap-3">
            <Select value={role} onValueChange={(v) => setRole(v as 'user' | 'admin')}>
              <SelectTrigger className="flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">user</SelectItem>
                <SelectItem value="admin">admin</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleAddUser} disabled={isLoading} className="flex-1">
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Добавить
            </Button>
            <Button onClick={loadData} variant="secondary" className="flex-1">
              Обновить списки
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Поиск по ID/username"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </Card>

        <div>
          <h2 className="text-xl font-bold mb-3">Админы</h2>
          <div className="space-y-2">
            {admins.map((user) => (
              <Card key={user.id} className="p-4 flex items-center justify-between">
                <div>
                  <div className="font-bold">{user.telegram_id}</div>
                  {user.username && <div className="text-sm text-muted-foreground">@{user.username}</div>}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePromoteUser(user.id, user.role)}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => handleDeleteUser(user.id)}>
                    Удалить
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-bold">
              Заявки {accessRequests.length > 0 && `(${accessRequests.length})`}
            </h2>
            {accessRequests.length > 0 && (
              <Button variant="secondary" size="sm" onClick={loadData}>
                Обновить
              </Button>
            )}
          </div>
          <div className="space-y-2">
            {accessRequests.map((request) => (
              <Card key={request.id} className="p-4">
                <div className="space-y-2">
                  <div>
                    {request.username && <div className="font-bold">@{request.username}</div>}
                    <div className="text-sm">{request.telegram_id}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(request.created_at).toLocaleString('ru-RU')}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleApproveRequest(request)}
                      className="flex-1"
                    >
                      Принять
                    </Button>
                    <Button
                      onClick={() => handleRejectRequest(request.id)}
                      variant="secondary"
                      className="flex-1"
                    >
                      Отклонить
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
            {accessRequests.length === 0 && (
              <div className="text-center text-muted-foreground py-8">Нет новых заявок</div>
            )}
          </div>
        </div>

        <div>
          <h2 className="text-xl font-bold mb-3">Пользователи</h2>
          <div className="space-y-2">
            {regularUsers.map((user) => (
              <Card key={user.id} className="p-4 flex items-center justify-between">
                <div>
                  <div className="font-bold">{user.telegram_id}</div>
                  {user.username && <div className="text-sm text-muted-foreground">@{user.username}</div>}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePromoteUser(user.id, user.role)}
                  >
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => handleDeleteUser(user.id)}>
                    Удалить
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
