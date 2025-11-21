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

    // Получаем удаленные номера
    const { data: platesData, error: platesError } = await supabaseAdmin
      .from('car_plates')
      .select('*')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false });

    if (platesError) {
      console.error('Error fetching deleted plates:', platesError);
      return new Response(
        JSON.stringify({ error: 'Failed to load deleted plates' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Получаем пользователей для маппинга
    const { data: usersData, error: usersError } = await supabaseAdmin
      .from('users')
      .select('telegram_id, username, first_name');

    if (usersError) {
      console.error('Error fetching users:', usersError);
    }

    const usersMap = new Map(
      (usersData || []).map(u => [u.telegram_id, u])
    );

    const rows = (platesData || []).map(plate => {
      const adder = usersMap.get(plate.added_by_telegram_id);
      const deleter = plate.deleted_by_telegram_id ? usersMap.get(plate.deleted_by_telegram_id) : null;
      
      return {
        plate_number: plate.plate_number,
        added_by_telegram_id: plate.added_by_telegram_id,
        added_by_username: adder?.username || '-',
        created_at: plate.created_at,
        deleted_by_telegram_id: plate.deleted_by_telegram_id || '-',
        deleted_by_username: deleter ? (deleter.username || deleter.first_name || '-') : '-',
        deleted_at: plate.deleted_at,
        attempt_count: plate.attempt_count || 0
      };
    });

    const header = ['Номер', 'Добавил (ID)', 'Добавил (Username)', 'Дата добавления', 'Удалил (ID)', 'Удалил (Username)', 'Дата удаления', 'Попыток'];
    const csvLines = [
      header.join(','),
      ...rows.map((row) => {
        const created = row.created_at ? new Date(row.created_at).toLocaleString('ru-RU') : '';
        const deleted = row.deleted_at ? new Date(row.deleted_at).toLocaleString('ru-RU') : '';

        return [
          row.plate_number,
          row.added_by_telegram_id,
          row.added_by_username,
          created,
          row.deleted_by_telegram_id,
          row.deleted_by_username,
          deleted,
          row.attempt_count,
        ].join(',');
      }),
    ];

    const csv = csvLines.join('\n');
    const encoder = new TextEncoder();
    const csvBytes = encoder.encode(csv);

    const fileName = `deleted_plates_${new Date().toISOString().split('T')[0]}.csv`;
    const file = new File([csvBytes], fileName, { type: 'text/csv' });

    const formData = new FormData();
    formData.append('chat_id', telegramId);
    formData.append('document', file);

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
      JSON.stringify({ success: true, count: rows.length }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Unexpected error in export-deleted-plates function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
