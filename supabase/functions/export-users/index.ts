import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const telegramId = body.telegramId as string | undefined;

    if (!telegramId) {
      return new Response(
        JSON.stringify({ error: 'Missing telegramId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const botToken = Deno.env.get('BOT_TOKEN');
    if (!botToken) {
      console.error('BOT_TOKEN not configured');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // Проверяем, является ли пользователь администратором
    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('telegram_id', telegramId)
      .maybeSingle();

    if (!userData) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { data: roleData } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', userData.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Получаем список всех пользователей с их ролями
    const { data: users, error } = await supabaseAdmin
      .from('users')
      .select(`
        telegram_id,
        username,
        first_name,
        created_at,
        user_roles (
          role
        )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching users:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to load users' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const rows = (users as any[]) || [];

    const header = ['Telegram ID', 'Username', 'Имя', 'Роль', 'Дата регистрации'];
    const csvLines = [
      header.join(','),
      ...rows.map((user) => {
        const created = user.created_at ? String(user.created_at).slice(0, 10) : '';
        const username = user.username ?? '';
        const firstName = user.first_name ?? '';
        const roles = user.user_roles?.map((r: any) => r.role).join(', ') || 'user';

        return [
          user.telegram_id,
          username,
          firstName,
          roles,
          created,
        ].join(',');
      }),
    ];

    const csv = csvLines.join('\n');
    const encoder = new TextEncoder();
    const csvBytes = encoder.encode(csv);

    const fileName = `users_${new Date().toISOString().split('T')[0]}.csv`;
    const file = new File([csvBytes], fileName, { type: 'text/csv' });

    const formData = new FormData();
    formData.append('chat_id', telegramId);
    formData.append('document', file);
    formData.append('caption', `📊 Список пользователей (всего: ${rows.length})`);

    const telegramResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, {
      method: 'POST',
      body: formData,
    });

    if (!telegramResponse.ok) {
      const text = await telegramResponse.text();
      console.error('Telegram sendDocument error:', text);
      return new Response(
        JSON.stringify({ error: 'Failed to send file to Telegram' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({ success: true, userCount: rows.length }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Unexpected error in export-users function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
