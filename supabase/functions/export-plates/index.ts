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

    const { data, error } = await supabaseAdmin.rpc('get_plate_export_data');

    if (error) {
      console.error('Error fetching plate export data:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to load data' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const rows = (data as any[]) || [];

    const header = ['Номер', 'Telegram ID', 'Username', 'Дата добавления', 'Последняя попытка', 'Попыток'];
    const csvLines = [
      header.join(','),
      ...rows.map((row) => {
        const created = row.created_at ? String(row.created_at).slice(0, 10) : '';
        const lastAttempt = row.last_attempt_at ? String(row.last_attempt_at).slice(0, 10) : '';
        const attemptCount = row.attempt_count ?? 0;
        const username = row.added_by_username ?? '';

        return [
          row.plate_number,
          row.added_by_telegram_id,
          username,
          created,
          lastAttempt,
          attemptCount,
        ].join(',');
      }),
    ];

    const csv = csvLines.join('\n');
    const encoder = new TextEncoder();
    const csvBytes = encoder.encode(csv);

    const fileName = `plates_${new Date().toISOString().split('T')[0]}.csv`;
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
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Unexpected error in export-plates function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
