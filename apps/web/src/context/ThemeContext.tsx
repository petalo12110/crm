import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'

type Theme = 'light' | 'dark'

interface ThemeContextValue {
  theme:       Theme
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

// Matches --color-surface-2 in globals.css exactly (light/dark) — the
// status bar should look like part of the app, not a mismatched black
// system bar sitting on top of it. Only runs on an actual native build
// (Capacitor.isNativePlatform() is false in a normal browser/PWA, where
// there's no system status bar to style at all).
async function syncStatusBar(theme: Theme): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try {
    await StatusBar.setBackgroundColor({ color: theme === 'dark' ? '#1e293b' : '#f8fafc' })
    // Capacitor's naming is content-based, not background-based: Style.Dark
    // means dark status bar *content* (icons/clock) — use on a light
    // background. Style.Light means light content — use on a dark one.
    await StatusBar.setStyle({ style: theme === 'dark' ? Style.Light : Style.Dark })
  } catch {
    // Non-fatal — worst case the status bar keeps its default look.
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem('theme') as Theme) ?? 'light'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
    syncStatusBar(theme)
  }, [theme])

  const toggleTheme = () => setTheme(t => (t === 'light' ? 'dark' : 'light'))

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
