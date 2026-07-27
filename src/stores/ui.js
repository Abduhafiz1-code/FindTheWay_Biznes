import { ref, computed, watch } from 'vue'
import { defineStore } from 'pinia'
import { messages, AVAILABLE_LOCALES } from '../i18n/messages'

// Mavjud rang mavzulari. `name` — style.css dagi @plugin "daisyui/theme" nomi,
// `labelKey` — tarjima kaliti, `swatch` — tanlash menyusidagi rang nuqtalari.
export const AVAILABLE_THEMES = [
  { name: 'ftw-dark', labelKey: 'theme.dark', swatch: ['#0F1B33', '#F5A623', '#5FBFB3'] },
  { name: 'ftw-light', labelKey: 'theme.light', swatch: ['#FFFFFF', '#C87F0A', '#1F8C7E'] },
  { name: 'ftw-ocean', labelKey: 'theme.ocean', swatch: ['#071A2B', '#22D3EE', '#3B82F6'] },
  { name: 'ftw-forest', labelKey: 'theme.forest', swatch: ['#0A1F14', '#4ADE80', '#A3E635'] },
  { name: 'ftw-violet', labelKey: 'theme.violet', swatch: ['#140B22', '#C084FC', '#F472B6'] },
  { name: 'ftw-sand', labelKey: 'theme.sand', swatch: ['#FFFDF8', '#B45309', '#0F766E'] },
]

const LOCALE_KEY = 'ftw-locale'
const THEME_KEY = 'ftw-theme'
const DEFAULT_LOCALE = 'uz'
const DEFAULT_THEME = 'ftw-dark'

function readStored(key, allowed, fallback) {
  try {
    const value = localStorage.getItem(key)
    return allowed.includes(value) ? value : fallback
  } catch {
    return fallback
  }
}

/**
 * Nuqta bilan ajratilgan kalit bo'yicha obyektdan qiymat oladi.
 * Masalan: resolve(messages.uz, 'hero.title1')
 */
function resolve(source, path) {
  return path.split('.').reduce((acc, part) => {
    if (acc && Object.prototype.hasOwnProperty.call(acc, part)) return acc[part]
    return undefined
  }, source)
}

export const useUiStore = defineStore('ui', () => {
  const localeCodes = AVAILABLE_LOCALES.map((l) => l.code)
  const themeNames = AVAILABLE_THEMES.map((t) => t.name)

  const locale = ref(readStored(LOCALE_KEY, localeCodes, DEFAULT_LOCALE))
  const theme = ref(readStored(THEME_KEY, themeNames, DEFAULT_THEME))

  const locales = computed(() => AVAILABLE_LOCALES)
  const themes = computed(() => AVAILABLE_THEMES)
  const currentLocale = computed(
    () => AVAILABLE_LOCALES.find((l) => l.code === locale.value) ?? AVAILABLE_LOCALES[0]
  )
  const currentTheme = computed(
    () => AVAILABLE_THEMES.find((t) => t.name === theme.value) ?? AVAILABLE_THEMES[0]
  )

  /**
   * Tarjima. Kalit topilmasa — o'zbekchaga, u ham bo'lmasa kalitning
   * o'ziga qaytadi, shunda ekranda hech qachon bo'sh joy qolmaydi.
   */
  function t(key) {
    const value = resolve(messages[locale.value], key)
    if (value !== undefined) return value
    const fallback = resolve(messages[DEFAULT_LOCALE], key)
    return fallback !== undefined ? fallback : key
  }

  function setLocale(code) {
    if (!localeCodes.includes(code)) return
    locale.value = code
  }

  function setTheme(name) {
    if (!themeNames.includes(name)) return
    theme.value = name
  }

  // Mavzuni <html data-theme="..."> ga yozamiz — daisyUI shundan o'qiydi.
  function applyTheme() {
    document.documentElement.setAttribute('data-theme', theme.value)
  }

  function applyLocale() {
    document.documentElement.setAttribute('lang', locale.value)
  }

  watch(theme, (value) => {
    applyTheme()
    try {
      localStorage.setItem(THEME_KEY, value)
    } catch {
      /* localStorage yopiq bo'lsa — jim o'tamiz */
    }
  })

  watch(locale, (value) => {
    applyLocale()
    try {
      localStorage.setItem(LOCALE_KEY, value)
    } catch {
      /* localStorage yopiq bo'lsa — jim o'tamiz */
    }
  })

  // Ilova ishga tushganda saqlangan holatni DOM'ga qo'llash uchun
  function init() {
    applyTheme()
    applyLocale()
  }

  return {
    locale,
    theme,
    locales,
    themes,
    currentLocale,
    currentTheme,
    t,
    setLocale,
    setTheme,
    init,
  }
})
