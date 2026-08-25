import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.1";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
const groqApiKey = Deno.env.get("GROQ_API_KEY") || "";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface AiMessage {
  role: "user" | "assistant";
  content: string;
}

async function getGroqResponse(
  conversationHistory: AiMessage[],
  centerInfo: Record<string, unknown>,
): Promise<{ message: string; tokens_used: number }> {
  if (!groqApiKey) {
    return {
      message: "AI xizmat hali ishga tushirilmagan. Admin bilan bog'laning.",
      tokens_used: 0,
    };
  }

  const systemPrompt = `Siz FindTheWay platformasidagi markaz egasiga yordamchi AI assistant siz.
Markaz ma'lumotlari: ${JSON.stringify(centerInfo)}
Markaz egasi uchun til — O'zbek tili (o'zbek kirilitsasi).
Quyidagilarda yordam bering:
- Kurs va dastur rejalashtirish
- Talabalar bilan ishlash
- Reklama strategiyasi
- Tariflar va to'lovlar
- Texnik muammolar (agar bo'lsa)

Javob qisqa va amaliy bo'lsin.`;

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
          ...conversationHistory,
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("Groq error:", error);
      return {
        message: "Javob olishda xatolik yuz berdi. Qayta urining.",
        tokens_used: 0,
      };
    }

    const data = await response.json();
    const message = data.choices?.[0]?.message?.content || "No response";
    const tokensUsed = data.usage?.completion_tokens || 0;

    return { message, tokens_used: tokensUsed };
  } catch (error) {
    console.error("Error calling Groq:", error);
    return {
      message: "AI xizmatida texnik xatolik yuz berdi.",
      tokens_used: 0,
    };
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
    const { conversation_id, message, context } = await req.json();

    if (
      !conversation_id ||
      typeof message !== "string" ||
      !message.trim() ||
      message.length > 4000
    ) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) {
      return new Response("Unauthorized", { status: 401 });
    }

    // Service-role query is safe only after confirming that this conversation
    // belongs to the caller.
    const { data: conversation, error: convError } = await supabase
      .from("ai_conversations")
      .select("*, centers(id, name, description)")
      .eq("id", conversation_id)
      .eq("owner_id", userData.user.id)
      .single();

    if (convError || !conversation) {
      return new Response(JSON.stringify({ error: "Conversation not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Load previous messages
    const { data: previousMessages, error: msgError } = await supabase
      .from("ai_messages")
      .select("role, content")
      .eq("conversation_id", conversation_id)
      .order("created_at", { ascending: true })
      .limit(10); // Keep last 10 for context

    if (msgError) console.error("Error loading messages:", msgError);

    const conversationHistory = [...(previousMessages || [])] as AiMessage[];
    const lastMessage = conversationHistory.at(-1);
    // Frontend foydalanuvchi xabarini funksiyani chaqirishdan oldin saqlaydi.
    // Shu sababli bir xabarni Groq'ga ikki marta yubormaymiz.
    if (lastMessage?.role !== "user" || lastMessage.content !== message.trim()) {
      conversationHistory.push({ role: "user", content: message.trim() });
    }

    // Get AI response
    const result = await getGroqResponse(
      conversationHistory,
      conversation.centers || {},
    );

    return new Response(
      JSON.stringify({
        message: result.message,
        tokens_used: result.tokens_used,
        context: context || conversation.context,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Error in ai-chat function:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
});
