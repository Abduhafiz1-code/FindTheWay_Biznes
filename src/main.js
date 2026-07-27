import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { useUiStore } from './stores/ui'
import { useAuthStore } from './stores/auth'
import './style.css'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)

// Mavzu va tilni brauzer xotirasidan tiklaymiz
useUiStore(pinia).init()

// Sessiyani router guard'idan oldin ishga tushiramiz
useAuthStore(pinia)
  .init()
  .catch((error) => {
    console.warn('[FindTheWay Biznes] Sessiyani yuklab bo\'lmadi:', error?.message || error)
  })

app.use(router)
app.mount('#app')
