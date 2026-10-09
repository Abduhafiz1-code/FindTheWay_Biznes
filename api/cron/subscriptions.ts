// Vercel cron endpoint — kuniga 1 marta chaqiriladi (vercel.json: 0 9 * * *)
// POST /api/cron/subscriptions

import type { VercelRequest, VercelResponse } from "@vercel/node";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const CRON_SECRET = process.env.CRON_SECRET || "";

interface EdgeFunctionResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<VercelResponse> {
  // Only allow POST
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Vercel cron CRON_SECRET env o'rnatilganda har bir so'rovga
  // avtomatik "Authorization: Bearer <CRON_SECRET>" sarlavhasini
  // qo'shadi. Bu tekshiruvsiz istalgan odam eslatma yuborish
  // jarayonini ishga tushirardi.
  const authHeader = req.headers["authorization"] || "";
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({
      error:
        "Server env sozlanmagan: VITE_SUPABASE_URL va SUPABASE_SERVICE_ROLE_KEY kerak",
    });
  }

  try {
    // Call the Supabase Edge Function
    const response = await fetch(`${SUPABASE_URL}/functions/v1/send-reminder`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "check_subscriptions" }),
    });

    const data = (await response.json()) as EdgeFunctionResponse;

    if (!response.ok) {
      console.error("Edge Function error:", data);
      return res
        .status(response.status)
        .json({ error: data.error || "Edge function failed" });
    }

    console.log("Reminder job completed:", data);
    return res.status(200).json({
      success: true,
      message: data.message || "Reminders sent successfully",
    });
  } catch (error) {
    console.error("Cron handler error:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
