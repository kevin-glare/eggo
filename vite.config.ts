import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' — относительные пути к бандлу, чтобы приложение работало
// на любом поддомене хостинга (нужно для Telegram Mini App).
export default defineConfig({
  plugins: [react()],
  base: './',
})
