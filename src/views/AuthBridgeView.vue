<script setup>
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { supabase } from "../supabase";

const router = useRouter();
const errorMessage = ref("");

onMounted(async () => {
  const params = new URLSearchParams(window.location.hash.slice(1));
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");

  if (!accessToken || !refreshToken) {
    await router.replace({ name: "login" });
    return;
  }

  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (error) {
    errorMessage.value = error.message;
    await router.replace({ name: "login" });
    return;
  }

  window.history.replaceState(
    {},
    document.title,
    `${window.location.pathname}${window.location.search}`,
  );
  await router.replace({ name: "dashboard" });
});
</script>

<template>
  <main class="flex min-h-dvh items-center justify-center p-6">
    <p v-if="errorMessage" class="text-sm text-error">{{ errorMessage }}</p>
    <p v-else class="text-sm opacity-60">Sessiya yuklanmoqda...</p>
  </main>
</template>
