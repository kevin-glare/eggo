import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { hasTelegramSession } from './telegram'
import TelegramGate from './ui/TelegramGate'

// в проде без Telegram играть нельзя: нет initData — нет синка и пушей,
// питомец живёт в одном браузере и теряется. В дев-режиме (localhost) — можно
const gated = import.meta.env.PROD && !hasTelegramSession()

createRoot(document.getElementById('root')!).render(
  <StrictMode>{gated ? <TelegramGate /> : <App />}</StrictMode>,
)
