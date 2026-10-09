# FindTheWay Biznes

O'quv markazlari egalari uchun FindTheWay boshqaruv paneli. Markaz profili, kurslar, arizalar, to'lov cheklari, Telegram eslatmalari va Groq asosidagi AI yordamchini boshqaradi.

## Ishga tushirish

```bash
npm install
npm run dev
```

`.env` faylida quyidagilar bo'lishi kerak:

```text
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## Production deploy

Vercel build sozlamalari:

```text
Build Command: npm run build
Output Directory: dist
Production Branch: main
```

Supabase Edge Functions uchun `GROQ_API_KEY` va `TELEGRAM_BOT_TOKEN` qiymatlarini Supabase Secrets orqali qo'shing. Ularni hech qachon front-end `.env` fayliga yozmang.

Vercel'da esa `CRON_SECRET` muhit o'zgaruvchisini qo'shing — `/api/cron/subscriptions` cron so'rovlarini shu sir bilan tekshiradi (Vercel cron uni avtomatik yuboradi).

Deploy qilinadigan funksiyalar:

```text
ai-chat
send-reminder
polish-message
```
