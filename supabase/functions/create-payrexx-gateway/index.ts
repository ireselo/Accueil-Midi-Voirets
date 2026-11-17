// Supabase Edge Function : create-payrexx-gateway
// Crée une réservation, vérifie les délais et le quota (40 places incl. CLI),
// et initialise un paiement Twint en CHF via Payrexx (ou confirme directement si 0 CHF).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateReservationPayload {
  mealDate: string; // Format YYYY-MM-DD
  service: '12h00' | '12h50';
  successRedirectUrl?: string;
  cancelRedirectUrl?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const authHeader = req.headers.get('Authorization') ?? '';

    const supabaseUserClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: authHeader } },
    });
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const {
      data: { user },
      error: authError,
    } = await supabaseUserClient.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Authentification requise pour effectuer une réservation.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: CreateReservationPayload = await req.json();
    const { mealDate, service, successRedirectUrl, cancelRedirectUrl } = body;

    // 1. Vérifier que les inscriptions sont ouvertes (lundi/mardi -> vendredi 18h00 ; jeudi/vendredi -> mercredi 18h00)
    const { data: isOpen, error: openError } = await supabaseAdmin.rpc('is_registration_open', {
      p_meal_date: mealDate,
    });

    if (openError || !isOpen) {
      return new Response(
        JSON.stringify({
          error:
            'Les inscriptions pour ce jour sont fermées (clôture le vendredi à 18h00 pour lundi/mardi, et le mercredi à 18h00 pour jeudi/vendredi).',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Vérifier le nombre de places restantes (limite de 40 places incluant les 6 personnes de la CLI)
    const { data: remainingCapacity, error: capError } = await supabaseAdmin.rpc(
      'get_remaining_capacity',
      {
        p_meal_date: mealDate,
        p_service: service,
      }
    );

    if (capError || (remainingCapacity ?? 0) <= 0) {
      return new Response(
        JSON.stringify({
          error: 'Complet : le nombre maximum de 40 personnes inscrites est atteint pour ce service.',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Récupérer le profil de l'utilisateur et son tarif en CHF
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: 'Profil utilisateur introuvable.' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: priceChf } = await supabaseAdmin.rpc('get_price_for_category', {
      p_category: profile.category,
    });

    const amountChf = Number(priceChf ?? 8.0);

    // 4. Cas 0 CHF (Élève totalement subventionné) : confirmation immédiate + génération du QR code
    if (amountChf === 0) {
      const qrToken = crypto.randomUUID();
      const { data: reservation, error: resError } = await supabaseAdmin
        .from('reservations')
        .insert({
          meal_date: mealDate,
          service,
          user_id: user.id,
          is_cli: false,
          price_chf: 0,
          status: 'confirmed',
          qr_code_token: qrToken,
          created_by: user.id,
        })
        .select('*')
        .single();

      if (resError) {
        return new Response(
          JSON.stringify({ error: resError.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      await supabaseAdmin.from('payments').insert({
        reservation_id: reservation.id,
        user_id: user.id,
        amount_chf: 0,
        currency: 'CHF',
        payment_method: 'free_subsidy',
        status: 'exempt',
        paid_at: new Date().toISOString(),
      });

      return new Response(
        JSON.stringify({
          status: 'confirmed',
          amountChf: 0,
          currency: 'CHF',
          reservation,
          qrCodeToken: qrToken,
          message: 'Inscription confirmée (subvention totale - 0.00 CHF).',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 5. Cas payant (10 CHF Adulte, 8 CHF Élève, 4 CHF Élève partiellement subventionné) -> Payrexx Twint
    const { data: pendingReservation, error: pendingError } = await supabaseAdmin
      .from('reservations')
      .insert({
        meal_date: mealDate,
        service,
        user_id: user.id,
        is_cli: false,
        price_chf: amountChf,
        status: 'pending_payment',
        created_by: user.id,
      })
      .select('*')
      .single();

    if (pendingError) {
      return new Response(
        JSON.stringify({ error: pendingError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payrexxInstance = Deno.env.get('PAYREXX_INSTANCE') ?? '';
    const payrexxApiSecret = Deno.env.get('PAYREXX_API_SECRET') ?? '';
    const referenceId = `AMV-${pendingReservation.id}`;

    let gatewayId = `sim-${crypto.randomUUID()}`;
    let paymentLink = `https://${payrexxInstance || 'demo'}.payrexx.com/fr/?payment=${gatewayId}`;

    // Si les identifiants Payrexx sont configurés, appel réel à l'API Payrexx Gateway (Twint CHF)
    if (payrexxInstance && payrexxApiSecret) {
      const formParams = new URLSearchParams();
      formParams.append('amount', String(Math.round(amountChf * 100))); // Centimes de CHF
      formParams.append('currency', 'CHF');
      formParams.append('pm[0]', 'twint');
      formParams.append('referenceId', referenceId);
      formParams.append('purpose', `Repas du ${mealDate} (${service})`);
      formParams.append('fields[forename][value]', profile.first_name);
      formParams.append('fields[surname][value]', profile.last_name);
      formParams.append('fields[email][value]', profile.email);
      if (successRedirectUrl) formParams.append('successRedirectUrl', successRedirectUrl);
      if (cancelRedirectUrl) formParams.append('cancelRedirectUrl', cancelRedirectUrl);

      // Signature HMAC-SHA256 requise par Payrexx
      const encoder = new TextEncoder();
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(payrexxApiSecret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      const signatureBuffer = await crypto.subtle.sign(
        'HMAC',
        key,
        encoder.encode(formParams.toString())
      );
      const apiSignature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));
      formParams.append('ApiSignature', apiSignature);

      const payrexxResp = await fetch(
        `https://api.payrexx.com/v1.0/Gateway/?instance=${encodeURIComponent(payrexxInstance)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formParams.toString(),
        }
      );

      const payrexxJson = await payrexxResp.json();
      if (payrexxJson?.status === 'success' && payrexxJson?.data?.[0]) {
        gatewayId = String(payrexxJson.data[0].id);
        paymentLink = payrexxJson.data[0].link;
      }
    }

    await supabaseAdmin.from('payments').insert({
      reservation_id: pendingReservation.id,
      user_id: user.id,
      amount_chf: amountChf,
      currency: 'CHF',
      payment_method: 'twint_payrexx',
      status: 'pending',
      payrexx_gateway_id: gatewayId,
      payrexx_reference_id: referenceId,
      payrexx_payment_link: paymentLink,
    });

    return new Response(
      JSON.stringify({
        status: 'pending_payment',
        amountChf,
        currency: 'CHF',
        reservationId: pendingReservation.id,
        payrexxGatewayId: gatewayId,
        paymentLink,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Erreur interne du serveur' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
