import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { X, Loader2, UserPlus, Shield, Users, Download, List, Search, FileSpreadsheet, FileText } from 'lucide-react';
import { useTelegram } from '@/contexts/TelegramContext';
import { useNavigate } from 'react-router-dom';
import { useUserAccess } from '@/hooks/useUserAccess';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import * as XLSX from 'xlsx';

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

interface PlateData {
  plate_number: string;
  added_by_telegram_id: string;
  added_by_username: string | null;
  created_at: string;
  attempt_count: number;
  last_attempt_at?: string | null;
}

export default function Admin() {
  const { webApp, user: telegramUser } = useTelegram();
  const { isAdmin } = useUserAccess();
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);
  const [plates, setPlates] = useState<PlateData[]>([]);
  const [telegramId, setTelegramId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingUsers, setExportingUsers] = useState(false);
  const [plateSearchQuery, setPlateSearchQuery] = useState('');

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

      const { data: platesData } = await supabase.rpc('get_plate_export_data');

      if (usersWithRoles) setUsers(usersWithRoles);
      if (requestsData) setAccessRequests(requestsData);
      if (platesData) setPlates(platesData);
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
        .delete()
        .eq('id', requestId);

      if (error) throw error;

      toast.success('Запрос отклонен');
      loadData();
    } catch (error: any) {
      console.error('Error rejecting request:', error);
      toast.error(error.message || 'Ошибка при отклонении запроса');
    }
  };

  const handleToggleRole = async (userId: string, telegramIdToToggle: string, currentIsAdmin: boolean) => {
    if (telegramIdToToggle === '785921635') {
      toast.error('Невозможно изменить роль супер админа');
      return;
    }

    try {
      if (currentIsAdmin) {
        // Удаляем роль admin
        await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', userId)
          .eq('role', 'admin');

        toast.success('Роль админа снята');
      } else {
        // Добавляем роль admin
        const { data: existingRole } = await supabase
          .from('user_roles')
          .select('id')
          .eq('user_id', userId)
          .eq('role', 'admin')
          .maybeSingle();

        if (!existingRole) {
          const { error: roleError } = await supabase
            .from('user_roles')
            .insert({
              user_id: userId,
              role: 'admin',
            });

          if (roleError) throw roleError;
        }

        toast.success('Пользователь повышен до админа');
      }

      loadData();
    } catch (error: any) {
      console.error('Error toggling role:', error);
      toast.error(error.message || 'Ошибка при изменении роли');
    }
  };

  const handleRemoveUser = async (userId: string, telegramIdToRemove: string) => {
    if (telegramIdToRemove === '785921635') {
      toast.error('Невозможно удалить супер админа');
      return;
    }

    try {
      // Удаляем роли пользователя
      const { error: rolesError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      if (rolesError) throw rolesError;

      // Удаляем все заявки пользователя
      const { error: requestsError } = await supabase
        .from('access_requests')
        .delete()
        .eq('telegram_id', telegramIdToRemove);

      if (requestsError) throw requestsError;

      // Удаляем самого пользователя
      const { error: userError } = await supabase
        .from('users')
        .delete()
        .eq('id', userId);

      if (userError) throw userError;

      toast.success('Пользователь полностью удален');
      loadData();
    } catch (error: any) {
      console.error('Error removing user:', error);
      toast.error(error.message || 'Ошибка при удалении пользователя');
    }
  };

  const handleExportPlates = async () => {
    setExportingCsv(true);
    try {
      // В Telegram Mini App отправляем файл прямо в чат пользователя
      if (webApp && telegramUser) {
        const { error: funcError } = await supabase.functions.invoke('export-plates', {
          body: { telegramId: telegramUser.id.toString() },
        });

        if (funcError) throw funcError;

        toast.success('CSV файл отправлен вам в Telegram');
        return;
      }

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
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = `plates_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success('CSV экспортирован');
    } catch (error) {
      console.error('Error exporting:', error);
      toast.error('Ошибка экспорта');
    } finally {
      setExportingCsv(false);
    }
  };

  const handleExportExcel = async () => {
    setExportingExcel(true);
    try {
      // В Telegram Mini App также отправляем файл в чат (в CSV формате для открытия в Excel/Sheets)
      if (webApp && telegramUser) {
        const { error: funcError } = await supabase.functions.invoke('export-plates', {
          body: { telegramId: telegramUser.id.toString() },
        });

        if (funcError) throw funcError;

        toast.success('Файл отправлен вам в Telegram, откройте его в Excel или Google Sheets');
        return;
      }

      const { data, error } = await supabase.rpc('get_plate_export_data');
      
      if (error) throw error;

      // Подготовка данных для Excel
      const worksheetData = [
        ['Номер', 'Telegram ID', 'Username', 'Дата добавления', 'Последняя попытка', 'Попыток'],
        ...(data || []).map((row: any) => [
          row.plate_number,
          row.added_by_telegram_id,
          row.added_by_username || '',
          new Date(row.created_at).toLocaleDateString('ru-RU'),
          row.last_attempt_at ? new Date(row.last_attempt_at).toLocaleDateString('ru-RU') : '',
          row.attempt_count || 0
        ])
      ];

      // Создаем рабочую книгу и лист
      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Номера');

      // Настраиваем ширину колонок
      worksheet['!cols'] = [
        { wch: 15 }, // Номер
        { wch: 15 }, // Telegram ID
        { wch: 20 }, // Username
        { wch: 15 }, // Дата добавления
        { wch: 15 }, // Последняя попытка
        { wch: 10 }  // Попыток
      ];

      // Генерируем файл
      const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const fileName = `plates_${new Date().toISOString().split('T')[0]}.xlsx`;

      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success('Excel файл экспортирован');
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      toast.error('Ошибка экспорта в Excel');
    } finally {
      setExportingExcel(false);
    }
  };

  const handleExportUsers = async () => {
    setExportingUsers(true);
    try {
      if (!telegramUser) {
        toast.error('Ошибка: не удалось определить пользователя');
        return;
      }

      const { error: funcError } = await supabase.functions.invoke('export-users', {
        body: { telegramId: telegramUser.id.toString() },
      });

      if (funcError) throw funcError;

      toast.success('Список пользователей отправлен вам в Telegram');
    } catch (error) {
      console.error('Error exporting users:', error);
      toast.error('Ошибка экспорта пользователей');
    } finally {
      setExportingUsers(false);
    }
  };

  if (!isAuthorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  };

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
                          {new Date(request.created_at).toLocaleString('ru-RU', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: false
                          })}
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
                  onClick={handleExportUsers}
                  disabled={exportingUsers}
                >
                  {exportingUsers ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  Экспорт пользователей
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
                    <div className="flex items-center gap-2">
                      {user.telegram_id !== '785921635' && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleToggleRole(
                              user.id, 
                              user.telegram_id, 
                              user.user_roles.some(r => r.role === 'admin')
                            )}
                            className={user.user_roles.some(r => r.role === 'admin') 
                              ? "hover:bg-destructive/10 hover:text-destructive" 
                              : "hover:bg-accent/10 hover:text-accent"}
                          >
                            <Shield className="h-4 w-4 mr-1" />
                            {user.user_roles.some(r => r.role === 'admin') ? 'Снять админа' : 'Сделать админом'}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveUser(user.id, user.telegram_id)}
                            className="hover:bg-destructive/10 hover:text-destructive"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
                {users.length === 0 && (
                  <div className="text-center text-muted-foreground py-8">
                    Нет пользователей
                  </div>
                )}
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <List className="h-5 w-5 text-accent" />
                  Все номера ({plates.filter(p => 
                    p.plate_number.toLowerCase().includes(plateSearchQuery.toLowerCase()) ||
                    (p.added_by_username && p.added_by_username.toLowerCase().includes(plateSearchQuery.toLowerCase())) ||
                    p.added_by_telegram_id.includes(plateSearchQuery)
                  ).length})
                </h2>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={exportingCsv || exportingExcel}
                    >
                      {exportingCsv || exportingExcel ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Download className="h-4 w-4 mr-2" />
                      )}
                      Экспорт
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleExportPlates}>
                      <FileText className="h-4 w-4 mr-2" />
                      CSV формат
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleExportExcel}>
                      <FileSpreadsheet className="h-4 w-4 mr-2" />
                      Excel формат (XLSX)
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              
              <div className="mb-4 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Поиск по номеру, username или Telegram ID..."
                  value={plateSearchQuery}
                  onChange={(e) => setPlateSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {plates.filter(p => 
                  p.plate_number.toLowerCase().includes(plateSearchQuery.toLowerCase()) ||
                  (p.added_by_username && p.added_by_username.toLowerCase().includes(plateSearchQuery.toLowerCase())) ||
                  p.added_by_telegram_id.includes(plateSearchQuery)
                ).length > 0 ? (
                  <div className="space-y-2">
                    {(() => {
                      const filteredPlates = plates.filter(p => 
                        p.plate_number.toLowerCase().includes(plateSearchQuery.toLowerCase()) ||
                        (p.added_by_username && p.added_by_username.toLowerCase().includes(plateSearchQuery.toLowerCase())) ||
                        p.added_by_telegram_id.includes(plateSearchQuery)
                      );

                      // Группируем номера по датам
                      const groupedPlates: { [key: string]: typeof filteredPlates } = {};
                      filteredPlates.forEach(plate => {
                        const dateKey = new Date(plate.created_at).toLocaleDateString('ru-RU', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric'
                        });
                        if (!groupedPlates[dateKey]) {
                          groupedPlates[dateKey] = [];
                        }
                        groupedPlates[dateKey].push(plate);
                      });

                      return Object.entries(groupedPlates).map(([dateKey, groupPlates]) => (
                        <div key={dateKey} className="space-y-2">
                          <div className="flex items-center gap-3 py-2">
                            <div className="h-px bg-border flex-1" />
                            <span className="text-sm font-semibold text-muted-foreground px-2">
                              {dateKey}
                            </span>
                            <div className="h-px bg-border flex-1" />
                          </div>
                          {groupPlates.map((plate, index) => (
                            <div
                              key={`${plate.plate_number}-${index}`}
                              className="flex items-center justify-between p-4 bg-secondary rounded-lg"
                            >
                              <div className="flex-1">
                                <div className="font-semibold text-foreground">
                                  {plate.plate_number}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  Добавил: {plate.added_by_username || plate.added_by_telegram_id}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {new Date(plate.created_at).toLocaleString('ru-RU', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    hour12: false
                                  })}
                                </div>
                                {plate.attempt_count > 1 && (
                                  <div className="text-xs text-amber-600">
                                    Попыток добавить: {plate.attempt_count}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ));
                    })()}
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    {plateSearchQuery ? 'Ничего не найдено' : 'Нет номеров'}
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
