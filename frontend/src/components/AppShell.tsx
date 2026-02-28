import type { ReactNode } from 'react'
import { Moon, Sun } from 'lucide-react'

import { Button } from '@/components/ui/button'

type AppShellProps = {
  title: string
  subtitle?: string
  isDarkMode: boolean
  onToggleDarkMode: () => void
  children: ReactNode
}

export function AppShell({
  title,
  subtitle,
  isDarkMode,
  onToggleDarkMode,
  children,
}: AppShellProps) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl items-start justify-center px-4 pb-[calc(1.5rem+var(--safe-area-bottom))] pt-[calc(1rem+var(--safe-area-top))] sm:px-6 sm:pb-[calc(2rem+var(--safe-area-bottom))] sm:pt-[calc(1.5rem+var(--safe-area-top))]">
      <section className="w-full space-y-4">
        <header className="flex items-start gap-3">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="shrink-0"
            onClick={onToggleDarkMode}
            aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDarkMode ? <Sun /> : <Moon />}
          </Button>
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
            {subtitle ? (
              <p className="text-xs text-muted-foreground sm:text-sm">{subtitle}</p>
            ) : null}
          </div>
        </header>
        {children}
      </section>
    </main>
  )
}
