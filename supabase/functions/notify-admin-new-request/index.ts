import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotifyRequest {
  telegramId: string;
  username: string | null;
  firstName: string | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { telegramId, username, firstName }: NotifyRequest = await req.json();
    console.log('New access request from:', { telegramId, username, firstName });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const botToken = Deno.env.get('BOT_TOKEN');

    if (!botToken) {
      throw new Error('BOT_TOKEN not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Получаем всех админов
    const { data: admins, error: adminsError } = await supabase
      .from('user_roles')
      .select('user_id, users!inner(telegram_id, username, first_name)')
      .eq('role', 'admin');

    if (adminsError) {
      console.error('Error fetching admins:', adminsError);
      throw adminsError;
    }

    if (!admins || admins.length === 0) {
      console.log('No admins found to notify');
      return new Response(
        JSON.stringify({ message: 'No admins to notify' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    console.log(`Found ${admins.length} admin(s) to notify`);

    // Формируем сообщение
    const userName = firstName || username || 'Без имени';
    const userInfo = username ? `@${username}` : `ID: ${telegramId}`;
    const message = `🔔 Новый запрос на доступ!\n\n👤 Пользователь: ${userName}\n📱 ${userInfo}\n🆔 Telegram ID: ${telegramId}\n\n⏰ ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Warsaw' })}`;

    // Отправляем уведомления всем админам
    const notificationPromises = admins.map(async (admin: any) => {
      const adminTelegramId = admin.users.telegram_id;
      
      try {
        const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: adminTelegramId,
            text: message,
            parse_mode: 'HTML',
          }),
        });

        const result = await response.json();
        
        if (!response.ok) {
          console.error(`Failed to send notification to admin ${adminTelegramId}:`, result);
          return { success: false, adminId: adminTelegramId, error: result };
        }

        console.log(`Notification sent successfully to admin ${adminTelegramId}`);
        return { success: true, adminId: adminTelegramId };
      } catch (error) {
        console.error(`Error sending notification to admin ${adminTelegramId}:`, error);
        return { success: false, adminId: adminTelegramId, error: String(error) };
      }
    });

    const results = await Promise.all(notificationPromises);
    const successCount = results.filter(r => r.success).length;
    
    console.log(`Sent ${successCount}/${admins.length} notifications successfully`);

    return new Response(
      JSON.stringify({ 
        message: `Notifications sent to ${successCount}/${admins.length} admins`,
        results 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 200 
      }
    );
  } catch (error: any) {
    console.error('Error in notify-admin-new-request:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 500 
      }
    );
  }
});
