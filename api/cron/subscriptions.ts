// Vercel cron endpoint — har soat chaqiriladi
// POST /api/cron/subscriptions

import type { VercelRequest, VercelResponse } from "@vercel/node";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

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

  // Vercel cron automatically verifies requests, so we don't need additional auth
  // But you can add extra protection if needed:
  const vercelCronSecret = req.headers["x-vercel-cron"];
  if (!vercelCronSecret) {
    console.log(
      "Warning: No Vercel cron header detected, but proceeding anyway",
    );
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
