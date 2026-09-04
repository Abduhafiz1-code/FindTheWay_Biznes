import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.1";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
const groqApiKey = Deno.env.get("GROQ_API_KEY") || "";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Admin yozgan javobni ma'noni saqlagan holda, tushunarli va
 * xushmuomala qilib qayta yozadi. Faqat ADMIN foydalana oladi.
 */
async function polish(text: string): Promise<string> {
  if (!groqApiKey) return text;

  const systemPrompt =
    `Siz FindTheWay platformasining qo'llab-quvvatlash xizmati yozishmalarini ` +
    `silliqlovchi yordamchisiz. Admin yozgan JAVOB matnini o'zbek tilida, ` +
    `xushmuomala, aniq va qisqa qilib qayta yozing. Ma'no, faktlar va xabar ` +
    `mohiyati o'zgarmasligi kerak. Savolga to'g'ridan-to'g'ri javob bering, ` +
    `odobli bo'ling. Faqat natijaviy matnni qaytaring — izoh, sarlavha yoki ` +
    `qo'shimcha matn yozmang.`;

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${groqApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `JAVOB:\n${text}` },
        ],
        temperature: 0.4,
        max_tokens: 600,
      }),
    });

    if (!response.ok) {
      console.error("Groq error:", await response.text());
      return text;
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || text;
  } catch (error) {
    console.error("Error calling Groq:", error);
    return text;
  }
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ") || !supabaseAnonKey) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const { text } = await req.json();
    if (typeof text !== "string" || !text.trim() || text.length > 2000) {
      return new Response(
        JSON.stringify({ error: "text 1..2000 belgi bo'lishi kerak" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // Kim chaqiryapti — faqat admin
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (profile?.role !== "admin") {
      return new Response("Forbidden", { status: 403 });
    }

    const polished = await polish(text.trim());

    return new Response(JSON.stringify({ polished }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in polish-message:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
