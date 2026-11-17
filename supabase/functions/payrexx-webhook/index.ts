// Supabase Edge Function : payrexx-webhook
// Réceptionne la confirmation de paiement Twint depuis Payrexx,
// génère le code QR personnel de l'inscription, valide la réservation dans Supabase
// et envoie l'e-mail de confirmation en français avec le code QR.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const payload = await req.json();
    const transaction = payload?.transaction;

    if (!transaction) {
      return new Response(
        JSON.stringify({ error: 'Payload webhook Payrexx invalide.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const referenceId: string =
      transaction?.referenceId ?? transaction?.invoice?.referenceId ?? '';
    const transactionStatus: string = transaction?.status ?? '';
    const transactionId: string = String(transaction?.id ?? '');

    if (!referenceId.startsWith('AMV-')) {
      return new Response(
        JSON.stringify({ error: 'Référence de réservation inconnue.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const reservationId = referenceId.replace('AMV-', '');

    if (transactionStatus === 'confirmed') {
      const qrToken = crypto.randomUUID();
      const nowIso = new Date().toISOString();

      // 1. Confirmer la réservation et attribuer le code QR personnel
      const { data: reservation, error: resError } = await supabaseAdmin
        .from('reservations')
        .update({
          status: 'confirmed',
          qr_code_token: qrToken,
          updated_at: nowIso,
        })
        .eq('id', reservationId)
        .select('*, profiles:user_id(first_name, last_name, email)')
        .single();

      if (resError || !reservation) {
        return new Response(
          JSON.stringify({ error: resError?.message ?? 'Réservation introuvable' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 2. Mettre à jour le statut du paiement Twint
      await supabaseAdmin
        .from('payments')
        .update({
          status: 'paid',
          payrexx_transaction_id: transactionId,
          paid_at: nowIso,
          confirmation_email_sent_at: nowIso,
          updated_at: nowIso,
        })
        .eq('reservation_id', reservationId);

      // 3. Envoi de l'e-mail de confirmation en français (via Resend / SMTP si configuré)
      const resendApiKey = Deno.env.get('RESEND_API_KEY');
      const recipientEmail = reservation.profiles?.email;

      if (resendApiKey && recipientEmail) {
        const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(
          qrToken
        )}`;

        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'Cafétéria Scolaire <noreply@accueil-midi-voirets.ch>',
            to: [recipientEmail],
            subject: `Confirmation d'inscription — Repas du ${reservation.meal_date} (${reservation.service})`,
            html: `
              <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; color: #1e293b;">
                <h2>Bonjour ${reservation.profiles.first_name} ${reservation.profiles.last_name},</h2>
                <p>Votre inscription et votre paiement Twint de <strong>${Number(
                  reservation.price_chf
                ).toFixed(2)} CHF</strong> ont bien été confirmés.</p>
                <ul>
                  <li><strong>Date du repas :</strong> ${reservation.meal_date}</li>
                  <li><strong>Service :</strong> ${reservation.service}</li>
                  <li><strong>Montant payé :</strong> ${Number(reservation.price_chf).toFixed(2)} CHF</li>
                </ul>
                <p>Veuillez présenter ce code QR personnel aux surveillants à votre arrivée (également accessible dans votre profil sur l'application) :</p>
                <p style="text-align: center; margin: 24px 0;">
                  <img src="${qrImageUrl}" alt="Code QR Personnel" width="220" height="220" />
                </p>
                <p style="font-size: 12px; color: #64748b;">Code de référence : ${qrToken}</p>
              </div>
            `,
          }),
        });
      }

      return new Response(
        JSON.stringify({
          received: true,
          status: 'confirmed',
          reservationId,
          qrCodeToken: qrToken,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (transactionStatus === 'cancelled' || transactionStatus === 'declined') {
      await supabaseAdmin
        .from('payments')
        .update({ status: 'failed', updated_at: new Date().toISOString() })
        .eq('reservation_id', reservationId);

      await supabaseAdmin
        .from('reservations')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', reservationId);
    }

    return new Response(JSON.stringify({ received: true, status: transactionStatus }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Erreur interne' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
