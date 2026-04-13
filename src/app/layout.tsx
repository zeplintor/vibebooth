import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'VibeBooth — Virtual Photobooth for Friends',
  description: 'Snap fun photos with 4 friends, together from anywhere!',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full overflow-hidden flex flex-col">
        <header className="text-center py-2 shrink-0">
          <h1 className="font-[family-name:var(--font-hand)] text-3xl font-bold text-vb-pink tracking-wide">
            VibeBooth
          </h1>
        </header>
        <main className="flex-1 flex flex-col items-center px-4 pb-2 min-h-0">
          {children}
        </main>
      </body>
    </html>
  )
}
