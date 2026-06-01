import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/inter'
import '@fontsource-variable/cairo'
import './assets/main.css'
import App from './App'
import { I18nProvider } from './i18n/I18nContext'
import { SettingsProvider } from './settings/SettingsContext'

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <SettingsProvider>
      <I18nProvider>
        <App />
      </I18nProvider>
    </SettingsProvider>
  </StrictMode>
)
