import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [tailwindcss(), vue()],
  // Desktop 5173 da ishlaydi, Biznes esa doim 5174 da — ikkalasini
  // bir vaqtda ochib turish uchun.
  server: { port: 5174 },
  preview: { port: 5174 },
});
