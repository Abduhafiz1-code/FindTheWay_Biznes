import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.1";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
const telegramBotToken = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface SubscriptionAlert {
  centerId: string;
  centerName: string;
  telegramChatId: string;
  daysLeft: number;
  isExpired: boolean;
}

async function sendTelegramMessage(
  chatId: string,
  message: string,
): Promise<boolean> {
  if (!telegramBotToken) {
    console.error("Telegram bot token not configured");
    return false;
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${telegramBotToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        }),
      },
    );

    const data = await response.json();
    if (!data.ok) {
      console.error(
        `Telegram error for ${chatId}: ${data.description || "Unknown error"}`,
      );
      return false;
    }

    console.log(`Message sent to ${chatId}`);
    return true;
  } catch (error) {
    console.error(`Failed to send Telegram message to ${chatId}:`, error);
    return false;
  }
}

async function checkAndNotifySubscriptions() {
  // Get all subscriptions that are:
  // 1. Expiring within 5 days, OR
  // 2. Already expired
  // AND have a telegram_chat_id configured
  const { data: subscriptions, error } = await supabase
    .from("subscriptions")
    .select(
      `
      id,
      center_id,
      status,
      trial_ends_at,
      paid_until,
      centers (
        id,
        name,
        owner_id,
        profiles:owner_id (telegram_chat_id)
      )
    `,
    )
    .or(
      `and(trial_ends_at.gt.now(),trial_ends_at.lt.${new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString()}),and(paid_until.gt.now(),paid_until.lt.${new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString()}),trial_ends_at.lt.now(),paid_until.lt.now()`,
    );

  if (error) {
    console.error("Error fetching subscriptions:", error.message);
    return [];
  }

  const alerts: SubscriptionAlert[] = [];
  const now = new Date();

  for (const sub of subscriptions || []) {
    const center = sub.centers;
    if (!center || !sub.center_id) continue;

    const telegramChatId = center.profiles?.telegram_chat_id;
    if (!telegramChatId) {
      console.log(
        `Subscription ${sub.id} has no Telegram chat ID, skipping...`,
      );
      continue;
    }

    const expiresAt = sub.paid_until || sub.trial_ends_at;
    if (!expiresAt) continue;

    const expiryDate = new Date(expiresAt);
    const daysLeft = Math.ceil(
      (expiryDate.getTime() - now.getTime()) / 86400000,
    );
    const isExpired = daysLeft < 0;

    alerts.push({
      centerId: sub.center_id,
      centerName: center.name || "Unknown Center",
      telegramChatId,
      daysLeft,
      isExpired,
    });
  }

  return alerts;
}

async function sendNotifications() {
  console.log("Starting subscription reminder check...");

  const alerts = await checkAndNotifySubscriptions();
  console.log(`Found ${alerts.length} subscriptions to notify`);

  let sentCount = 0;
  for (const alert of alerts) {
    let message = "";
    if (alert.isExpired) {
      message = `🚨 <b>Obunangiz tugagan</b>\n\nMarkaz: ${alert.centerName}\n\n✅ To'lov qilish uchun FindTheWay hisobiga kiring.`;
    } else {
      message = `⏰ <b>Obunangiz tugaydi</b>\n\nMarkaz: ${alert.centerName}\nQolgan vaqt: ${alert.daysLeft} kun\n\n✅ Hozirdan to'lov qiling.`;
    }

    const sent = await sendTelegramMessage(alert.telegramChatId, message);
    if (sent) sentCount++;
  }

  console.log(`Sent ${sentCount}/${alerts.length} notifications`);
  return sentCount;
}

serve(async (req) => {
  const authHeader = req.headers.get("Authorization");
  const isServiceRequest =
    !!supabaseServiceKey && authHeader === `Bearer ${supabaseServiceKey}`;
  const body = await req.json().catch(() => ({}));

  // Cron is the only caller allowed to notify every center.
  if (isServiceRequest) {
    try {
      const sentCount = await sendNotifications();
      return new Response(
        JSON.stringify({
          success: true,
          message: `Sent ${sentCount} notifications`,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    } catch (error) {
      console.error("Error in send-reminder function:", error);
      return new Response(
        JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }
  }

  // A signed-in owner may only send a test message to their own saved chat.
  if (body.action !== "test" || !authHeader?.startsWith("Bearer ") || !supabaseAnonKey) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, telegram_chat_id")
      .eq("id", userData.user.id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (profile?.role !== "owner" || !profile.telegram_chat_id) {
      return new Response(
        JSON.stringify({ success: false, error: "Telegram chat ID topilmadi." }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const sent = await sendTelegramMessage(
      profile.telegram_chat_id,
      "✅ FindTheWay test xabari muvaffaqiyatli yuborildi.",
    );
    return new Response(
      JSON.stringify({
        success: sent,
        message: sent ? "Test xabari yuborildi." : "Test xabari yuborilmadi.",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error in send-reminder function:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
