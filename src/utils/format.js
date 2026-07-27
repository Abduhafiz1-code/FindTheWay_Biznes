// Sana va narxni ikkala tilda bir xil ko'rinishda chiqarish uchun yordamchilar.
// Intl'ning uz-UZ qisqartmalari ("M07") chiroyli emas, shuning uchun qo'lda yozamiz.

const MONTHS = {
  uz: ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
}

function pad(value) {
  return String(value).padStart(2, '0')
}

export function formatDate(value, locale = 'uz') {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  const months = MONTHS[locale] ?? MONTHS.uz
  return `${d.getDate()} ${months[d.getMonth()]}`
}

export function formatDateTime(value, locale = 'uz') {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  const months = MONTHS[locale] ?? MONTHS.uz
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function formatPrice(value) {
  if (!value && value !== 0) return '—'
  return Number(value).toLocaleString('ru-RU').replace(/ /g, ' ')
}
