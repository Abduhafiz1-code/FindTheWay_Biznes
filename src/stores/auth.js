import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { supabase } from '../supabase'

// FindTheWay Biznes — faqat markaz egalari uchun autentifikatsiya store
export const useAuthStore = defineStore('auth', () => {
  const session = ref(null)
  const profile = ref(null)
  const loading = ref(true)
  const ready = ref(false)

  const user = computed(() => session.value?.user ?? null)
  const isAuthenticated = computed(() => !!session.value)
  const role = computed(() => profile.value?.role ?? user.value?.user_metadata?.role ?? null)
  const isOwner = computed(() => role.value === 'owner')

  const displayName = computed(
    () =>
      profile.value?.center_name ||
      profile.value?.full_name ||
      user.value?.user_metadata?.center_name ||
      user.value?.user_metadata?.full_name ||
      user.value?.email?.split('@')[0] ||
      '',
  )

  async function fetchProfile() {
    if (!user.value) {
      profile.value = null
      return null
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('id, role, full_name, center_name, phone, avatar_url')
      .eq('id', user.value.id)
      .maybeSingle()

    if (error) {
      console.warn('[FindTheWay Biznes] Profilni yuklab bo\'lmadi:', error.message)
      profile.value = null
      return null
    }
    profile.value = data
    return data
  }

  /**
   * Profil qatorini 'owner' holatiga keltiradi.
   * Ikki holatda kerak bo'ladi:
   *  1) trigger ishlamagan va profil umuman yaratilmagan;
   *  2) foydalanuvchi avval o'quvchi sifatida ro'yxatdan o'tgan va
   *     endi markaz hisobiga o'tmoqchi.
   */
  async function ensureOwnerProfile() {
    if (!user.value) throw new Error('Avval tizimga kiring.')
    const meta = user.value.user_metadata ?? {}

    const { data, error } = await supabase
      .from('profiles')
      .upsert(
        {
          id: user.value.id,
          role: 'owner',
          full_name: meta.full_name ?? meta.name ?? null,
          center_name: meta.center_name ?? null,
          phone: meta.phone ?? null,
        },
        { onConflict: 'id' },
      )
      .select('id, role, full_name, center_name, phone, avatar_url')
      .single()

    if (error) throw error
    profile.value = data

    // user_metadata ni ham moslashtiramiz, aks holda keyingi kirishda
    // yana eski rol qaytib qoladi.
    if (meta.role !== 'owner') {
      await supabase.auth.updateUser({ data: { ...meta, role: 'owner' } })
    }
    return data
  }

  // Metadata 'owner' desa-yu profil qatori mos kelmasa — jimgina tuzatamiz.
  async function repairProfileIfNeeded() {
    if (!user.value) return
    if (isOwner.value) return
    if (user.value.user_metadata?.role !== 'owner') return
    try {
      await ensureOwnerProfile()
    } catch (error) {
      console.warn('[FindTheWay Biznes] Profilni tuzatib bo\'lmadi:', error?.message)
    }
  }

  async function init() {
    try {
      const { data } = await supabase.auth.getSession()
      session.value = data.session
      if (session.value) await fetchProfile()
    } finally {
      // Xato bo'lsa ham ilova qotib qolmasligi kerak
      loading.value = false
      ready.value = true
    }

    supabase.auth.onAuthStateChange(async (_event, newSession) => {
      session.value = newSession
      if (newSession) await fetchProfile()
      else profile.value = null
    })
  }

  // Store tayyor bo'lguncha kutish — router guard shuni ishlatadi
  async function waitUntilReady() {
    if (ready.value) return
    await new Promise((resolve) => {
      const timer = setInterval(() => {
        if (ready.value) {
          clearInterval(timer)
          resolve()
        }
      }, 30)
    })
  }

  async function signInWithPassword(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    session.value = data.session
    await fetchProfile()
    await repairProfileIfNeeded()
    return data
  }

  /**
   * Markaz egasi sifatida ro'yxatdan o'tish.
   * role har doim 'owner' — bu panel faqat markazlar uchun.
   */
  async function signUpOwner({ email, password, centerName, ownerName, phone }) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          role: 'owner',
          center_name: centerName ?? null,
          full_name: ownerName ?? null,
          phone: phone ?? null,
        },
        emailRedirectTo: `${window.location.origin}/`,
      },
    })
    if (error) throw error
    if (data.session) {
      session.value = data.session
      await fetchProfile()
      await repairProfileIfNeeded()
    }
    return data
  }

  async function signInWithGoogle() {
    try {
      localStorage.setItem('ftw-pending-role', 'owner')
    } catch {
      /* e'tiborsiz */
    }
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`,
        queryParams: { prompt: 'select_account' },
      },
    })
    if (error) throw error
    return data
  }

  async function updatePassword(newPassword) {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) throw error
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    session.value = null
    profile.value = null
  }

  return {
    session,
    profile,
    user,
    loading,
    ready,
    role,
    isOwner,
    isAuthenticated,
    displayName,
    init,
    waitUntilReady,
    fetchProfile,
    ensureOwnerProfile,
    signInWithPassword,
    signUpOwner,
    signInWithGoogle,
    updatePassword,
    signOut,
  }
})
