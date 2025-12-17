import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AccessRequestPayload {
  telegramId: string;
  username?: string;
  firstName?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { telegramId, username, firstName }: AccessRequestPayload = await req.json();

    if (!telegramId) {
      return new Response(
        JSON.stringify({ error: 'Telegram ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Creating access request for telegram_id:', telegramId);

    // Create Supabase client with service role to bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // Check if user already has a pending request
    const { data: existingRequest, error: checkError } = await supabaseAdmin
      .from('access_requests')
      .select('id, status')
      .eq('telegram_id', telegramId)
      .eq('status', 'pending')
      .maybeSingle();

    if (checkError) {
      console.error('Error checking existing requests:', checkError);
      throw checkError;
    }

    if (existingRequest) {
      return new Response(
        JSON.stringify({ message: 'Access request already pending', requestId: existingRequest.id }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create new access request
    const { data: newRequest, error: insertError } = await supabaseAdmin
      .from('access_requests')
      .insert({
        telegram_id: telegramId,
        username: username || null,
        first_name: firstName || null,
        status: 'pending',
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('Error creating access request:', insertError);
      throw insertError;
    }

    console.log('Access request created successfully:', newRequest.id);

    return new Response(
      JSON.stringify({ success: true, requestId: newRequest.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in create-access-request:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to create access request' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
