import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { supabase } from '../supabase'
import { useAuthStore } from './auth'

export const APPLICATION_STATUSES = ['new', 'seen', 'contacted', 'accepted', 'rejected']

export const STATUS_META = {
  new: { labelKey: 'applications.statusNew', badge: 'badge-primary', dot: 'bg-primary' },
  seen: { labelKey: 'applications.statusSeen', badge: 'badge-ghost', dot: 'bg-base-content/40' },
  contacted: { labelKey: 'applications.statusContacted', badge: 'badge-info', dot: 'bg-info' },
  accepted: { labelKey: 'applications.statusAccepted', badge: 'badge-success', dot: 'bg-success' },
  rejected: { labelKey: 'applications.statusRejected', badge: 'badge-error', dot: 'bg-error' },
}

// Markaz, kurslar va arizalar bilan ishlaydigan asosiy store
export const useBizStore = defineStore('biz', () => {
  const center = ref(null)
  const courses = ref([])
  const applications = ref([])

  const loadingCenter = ref(false)
  const loadingCourses = ref(false)
  const loadingApplications = ref(false)
  const lastError = ref('')

  let channel = null

  const hasCenter = computed(() => !!center.value)

  const newCount = computed(() => applications.value.filter((a) => a.status === 'new').length)
  const acceptedCount = computed(
    () => applications.value.filter((a) => a.status === 'accepted').length,
  )
  const totalCount = computed(() => applications.value.length)
  const activeCourses = computed(() => courses.value.filter((c) => c.is_active !== false).length)
  const conversion = computed(() =>
    totalCount.value ? Math.round((acceptedCount.value / totalCount.value) * 100) : 0,
  )

  // Oxirgi 14 kunlik arizalar — dashboard grafigi uchun
  const chartData = computed(() => {
    const days = []
    const now = new Date()
    for (let i = 13; i >= 0; i -= 1) {
      const d = new Date(now)
      d.setDate(now.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      const count = applications.value.filter(
        (a) => String(a.created_at ?? '').slice(0, 10) === key,
      ).length
      days.push({ key, label: `${d.getDate()}`, count })
    }
    return days
  })

  function note(error, context) {
    if (!error) return
    lastError.value = error.message || String(error)
    console.warn(`[FindTheWay Biznes] ${context}:`, lastError.value)
  }

  async function loadCenter() {
    const auth = useAuthStore()
    if (!auth.user) return null
    loadingCenter.value = true
    const { data, error } = await supabase
      .from('centers')
      .select('*')
      .eq('owner_id', auth.user.id)
      .maybeSingle()
    loadingCenter.value = false
    if (error) {
      note(error, 'Markazni yuklash')
      return null
    }
    center.value = data
    return data
  }

  async function saveCenter(payload) {
    const auth = useAuthStore()
    if (!auth.user) throw new Error('Avval tizimga kiring')

    if (center.value?.id) {
      const { data, error } = await supabase
        .from('centers')
        .update(payload)
        .eq('id', center.value.id)
        .select()
        .single()
      if (error) throw error
      center.value = data
      return data
    }

    const { data, error } = await supabase
      .from('centers')
      .insert({ ...payload, owner_id: auth.user.id })
      .select()
      .single()
    if (error) throw error
    center.value = data
    return data
  }

  async function loadCourses() {
    if (!center.value?.id) {
      courses.value = []
      return []
    }
    loadingCourses.value = true
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .eq('center_id', center.value.id)
      .order('created_at', { ascending: false })
    loadingCourses.value = false
    if (error) {
      note(error, 'Kurslarni yuklash')
      return []
    }
    courses.value = data ?? []
    return courses.value
  }

  async function saveCourse(payload) {
    if (!center.value?.id) throw new Error('Avval markaz profilini yarating')
    if (payload.id) {
      const { id, ...rest } = payload
      const { data, error } = await supabase
        .from('courses')
        .update(rest)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      const index = courses.value.findIndex((c) => c.id === id)
      if (index !== -1) courses.value[index] = data
      return data
    }
    const { data, error } = await supabase
      .from('courses')
      .insert({ ...payload, center_id: center.value.id })
      .select()
      .single()
    if (error) throw error
    courses.value = [data, ...courses.value]
    return data
  }

  async function deleteCourse(id) {
    const { error } = await supabase.from('courses').delete().eq('id', id)
    if (error) throw error
    courses.value = courses.value.filter((c) => c.id !== id)
  }

  async function loadApplications() {
    if (!center.value?.id) {
      applications.value = []
      return []
    }
    loadingApplications.value = true
    const { data, error } = await supabase
      .from('applications')
      .select('*')
      .eq('center_id', center.value.id)
      .order('created_at', { ascending: false })
    loadingApplications.value = false
    if (error) {
      note(error, 'Arizalarni yuklash')
      return []
    }
    applications.value = data ?? []
    return applications.value
  }

  async function updateApplication(id, patch) {
    const { data, error } = await supabase
      .from('applications')
      .update(patch)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    const index = applications.value.findIndex((a) => a.id === id)
    if (index !== -1) applications.value[index] = data
    return data
  }

  function setStatus(id, status) {
    return updateApplication(id, { status })
  }

  // Realtime — yangi ariza kelganda ro'yxat o'zi yangilanadi
  function subscribe() {
    if (!center.value?.id || channel) return
    channel = supabase
      .channel(`applications-${center.value.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'applications',
          filter: `center_id=eq.${center.value.id}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            if (!applications.value.some((a) => a.id === payload.new.id)) {
              applications.value = [payload.new, ...applications.value]
            }
          } else if (payload.eventType === 'UPDATE') {
            const index = applications.value.findIndex((a) => a.id === payload.new.id)
            if (index !== -1) applications.value[index] = payload.new
          } else if (payload.eventType === 'DELETE') {
            applications.value = applications.value.filter((a) => a.id !== payload.old.id)
          }
        },
      )
      .subscribe()
  }

  function unsubscribe() {
    if (channel) {
      supabase.removeChannel(channel)
      channel = null
    }
  }

  // Panelga kirganda hammasini bir marta yuklaymiz
  async function bootstrap() {
    await loadCenter()
    if (center.value?.id) {
      await Promise.all([loadCourses(), loadApplications()])
      subscribe()
    }
  }

  function reset() {
    unsubscribe()
    center.value = null
    courses.value = []
    applications.value = []
    lastError.value = ''
  }

  return {
    center,
    courses,
    applications,
    loadingCenter,
    loadingCourses,
    loadingApplications,
    lastError,
    hasCenter,
    newCount,
    acceptedCount,
    totalCount,
    activeCourses,
    conversion,
    chartData,
    loadCenter,
    saveCenter,
    loadCourses,
    saveCourse,
    deleteCourse,
    loadApplications,
    updateApplication,
    setStatus,
    subscribe,
    unsubscribe,
    bootstrap,
    reset,
  }
})
