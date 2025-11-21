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

    // Отправляем уведомление только главному админу
    const MAIN_ADMIN_TELEGRAM_ID = '785921635';
    
    console.log('Sending notification to main admin only:', MAIN_ADMIN_TELEGRAM_ID);

    // Формируем сообщение
    const userName = firstName || username || 'Без имени';
    const userInfo = username ? `@${username}` : `ID: ${telegramId}`;
    const message = `🔔 Новый запрос на доступ!\n\n👤 Пользователь: ${userName}\n📱 ${userInfo}\n🆔 Telegram ID: ${telegramId}\n\n⏰ ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Warsaw' })}`;

    // Отправляем уведомление только главному админу
    try {
      const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: MAIN_ADMIN_TELEGRAM_ID,
          text: message,
          parse_mode: 'HTML',
        }),
      });

      const result = await response.json();
      
      if (!response.ok) {
        console.error(`Failed to send notification to main admin:`, result);
        return new Response(
          JSON.stringify({ error: 'Failed to send notification', details: result }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }

      console.log(`Notification sent successfully to main admin`);
      return new Response(
        JSON.stringify({ message: 'Notification sent to main admin successfully' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    } catch (error) {
      console.error(`Error sending notification:`, error);
      return new Response(
        JSON.stringify({ error: 'Failed to send notification', details: String(error) }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }
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
