import type { Metadata } from 'next'
import { Inter, Work_Sans, Source_Sans_3 } from 'next/font/google'
import './globals.css'

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const workSans = Work_Sans({ 
  subsets: ['latin'],
  variable: '--font-work-sans',
  display: 'swap',
})

const sourceSans = Source_Sans_3({ 
  subsets: ['latin'],
  variable: '--font-source-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Oasis International Care',
  description: 'Domiciliary care management platform',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${inter.variable} ${workSans.variable} ${sourceSans.variable}`}>
      <body className={inter.className}>{children}</body>
    </html>
  )
}
