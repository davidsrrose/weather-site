import { useEffect, useState } from "react"

export type ThemeMode = "light" | "dark"

function loadThemeMode(): ThemeMode {
  if (typeof window === "undefined") {
    return "light"
  }

  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
  return prefersDark ? "dark" : "light"
}

export function useThemePreference() {
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => loadThemeMode())

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle("dark", themeMode === "dark")
  }, [themeMode])

  const toggleThemeMode = () => {
    setThemeMode((currentMode) => (currentMode === "dark" ? "light" : "dark"))
  }

  return {
    themeMode,
    isDarkMode: themeMode === "dark",
    toggleThemeMode,
  }
}
