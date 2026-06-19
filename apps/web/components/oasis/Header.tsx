'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth, useClerk, useUser } from '@clerk/nextjs'
import { useSession, signOut as nextAuthSignOut } from 'next-auth/react'
import { cn } from '../../lib/utils'
import { InstallAppPrompt } from '../pwa/InstallAppPrompt'
import { resolveAuthMode } from '../../lib/auth/mode'
import {
  createClerkHeaderViewer,
  createNextAuthHeaderViewer,
  getHeaderAccessLabel,
  type HeaderViewer,
} from './headerIdentity'

const staffNavItems = [
  { href: '/today', label: 'Today', icon: '📊', aliases: ['/dashboard'] },
  { href: '/people', label: 'People', icon: '👥', aliases: ['/clients'] },
  { href: '/schedule', label: 'Schedule', icon: '📅', aliases: ['/visits'] },
  { href: '/family-updates', label: 'Family Updates', icon: '🤝', aliases: ['/carebridge'] },
  { href: '/medication', label: 'Medication Round', icon: '💊', aliases: ['/emar'] },
  { href: '/shift', label: 'My Shift', icon: '⏱️', aliases: [] },
] as const

const managementNavItems = [
  { href: '/management', label: 'Management', icon: '🧭', aliases: ['/activity'] },
  { href: '/staff', label: 'Workforce', icon: '👤', aliases: ['/admin/carers', '/admin/analytics'] },
  { href: '/evidence', label: 'Reports', icon: '📋', aliases: ['/admin/metrics'] },
  { href: '/settings', label: 'Settings', icon: '⚙️', aliases: [] },
] as const

const familyNavItems = [
  { href: '/family', label: 'Family Assurance', icon: '🏠', aliases: [] },
] as const

function isNavItemActive(pathname: string, item: { href: string; aliases?: readonly string[] }): boolean {
  const paths = [item.href, ...(item.aliases ?? [])]
  return paths.some((path) => pathname === path || pathname.startsWith(`${path}/`))
}

export interface HeaderProps {
  className?: string
  notificationCount?: number
}

interface HeaderContentProps extends HeaderProps {
  pathname: string
  viewer: HeaderViewer
  onSignOut: () => Promise<void>
}

function getBrowserAuthMode() {
  return resolveAuthMode({
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_AUTH_IDENTITY_PROVIDER: process.env.NEXT_PUBLIC_AUTH_IDENTITY_PROVIDER,
    NEXT_PUBLIC_LOCAL_AUTH_ENABLED: process.env.NEXT_PUBLIC_LOCAL_AUTH_ENABLED,
  } as NodeJS.ProcessEnv)
}

export function Header(props: HeaderProps) {
  if (getBrowserAuthMode() === 'clerk') {
    return <ClerkHeader {...props} />
  }

  return <NextAuthHeader {...props} />
}

function ClerkHeader({ className, notificationCount = 0 }: HeaderProps) {
  const pathname = usePathname()
  const { isLoaded, isSignedIn, orgRole } = useAuth()
  const { user } = useUser()
  const { signOut } = useClerk()
  const viewer = createClerkHeaderViewer({
    pathname,
    isLoaded,
    isSignedIn,
    userName: user?.fullName,
    userEmail: user?.primaryEmailAddress?.emailAddress,
    sessionClaims: {
      org_role: orgRole,
      public_metadata: user?.publicMetadata,
    },
  })

  async function handleSignOut() {
    await signOut({ redirectUrl: '/login' })
  }

  return (
    <HeaderContent
      className={className}
      notificationCount={notificationCount}
      pathname={pathname}
      viewer={viewer}
      onSignOut={handleSignOut}
    />
  )
}

function NextAuthHeader({ className, notificationCount = 0 }: HeaderProps) {
  const pathname = usePathname()
  const { data: session, status } = useSession()
  const viewer = createNextAuthHeaderViewer({
    pathname,
    status,
    roles: (session as any)?.roles ?? [],
    userName: session?.user?.name,
    userEmail: session?.user?.email,
  })

  async function handleSignOut() {
    try {
      await nextAuthSignOut({ redirect: false });
    } finally {
      window.location.assign('/api/auth/cognito-logout');
    }
  }

  return (
    <HeaderContent
      className={className}
      notificationCount={notificationCount}
      pathname={pathname}
      viewer={viewer}
      onSignOut={handleSignOut}
    />
  )
}

function HeaderContent({
  className,
  notificationCount = 0,
  pathname,
  viewer,
  onSignOut,
}: HeaderContentProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const { accessContext, userName, userEmail, userInitial, isAdmin } = viewer
  const userRole = getHeaderAccessLabel(viewer)
  const navItems = accessContext.isExternal
    ? familyNavItems
    : isAdmin
    ? [...staffNavItems, ...managementNavItems] as const
    : staffNavItems

  return (
    <header className={cn('bg-white border-b border-slate-200 sticky top-0 z-50', className)}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <Link href={accessContext.homePath} className="flex items-center gap-3">
              <div className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center shadow-lg',
                accessContext.isExternal
                  ? 'bg-gradient-to-br from-sky-500 to-cyan-700 shadow-sky-500/25'
                  : 'bg-gradient-to-br from-teal-500 to-teal-700 shadow-teal-500/25'
              )}>
                <span className="text-white font-bold text-lg">O</span>
              </div>
              <div className="hidden sm:block">
                <h1 className="font-heading font-bold text-lg text-slate-900 tracking-tight">
                  {accessContext.isExternal ? 'Family Assurance Hub' : 'Oasis Care'}
                </h1>
                <p className="text-xs text-slate-500 -mt-0.5">International</p>
              </div>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = isNavItemActive(pathname, item)
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                    'hover:bg-slate-100',
                    {
                      'bg-teal-50 text-teal-700 font-semibold': isActive,
                      'text-slate-600': !isActive
                    }
                  )}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {item.label}
                </Link>
              )
            })}
          </nav>

          {/* Right side - notifications & profile */}
          <div className="flex items-center gap-3">
            <div className="hidden lg:block">
              <InstallAppPrompt compact />
            </div>

            {/* Notifications */}
            <button 
              onClick={() => setNotificationsOpen((open) => !open)}
              className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors"
              aria-label={`Notifications ${notificationCount > 0 ? `(${notificationCount} new)` : ''}`}
            >
              <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {notificationCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                  {notificationCount > 9 ? '9+' : notificationCount}
                </span>
              )}
            </button>
            {notificationsOpen && (
              <div className="absolute right-20 top-14 z-50 w-80 rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
                <p className="text-sm font-semibold text-slate-900">Notifications</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Live notification delivery is coming with the outbox work. For now, use Today for urgent visits,
                  Family Updates for approvals, and Management for system checks.
                </p>
                <div className="mt-3 grid gap-2">
                  <Link href="/today" className="rounded-lg bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
                    Open Today Command Centre
                  </Link>
                  <Link href="/family-updates" className="rounded-lg bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
                    Review Family Updates
                  </Link>
                </div>
              </div>
            )}

            {/* Profile dropdown */}
            <div className="relative">
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-2 p-1.5 pr-3 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <div className="w-8 h-8 bg-gradient-to-br from-teal-400 to-teal-600 rounded-lg flex items-center justify-center text-white font-semibold text-sm">
                  {userInitial}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-sm font-medium text-slate-900">{userName || ' '}</p>
                  <p className="text-xs text-slate-500">
                    {userRole}
                  </p>
                </div>
                <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Profile dropdown menu */}
              {profileOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-slate-200 py-2 z-50">
                  <div className="px-4 py-2 border-b border-slate-100">
                    <p className="text-sm font-medium text-slate-900">{userName || 'User'}</p>
                    <p className="text-xs text-slate-500">{userEmail || userRole || 'No email available'}</p>
                  </div>
                  {accessContext.isExternal ? (
                    <Link href="/family" className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7.5A2.5 2.5 0 015.5 5h13A2.5 2.5 0 0121 7.5v9a2.5 2.5 0 01-2.5 2.5h-13A2.5 2.5 0 013 16.5v-9z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 10h10M7 14h6" />
                      </svg>
                      Family Assurance Hub
                    </Link>
                  ) : (
                    <>
                      <Link href="/settings" className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Settings
                      </Link>
                      <Link href="/shift" className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        My Shift
                      </Link>
                    </>
                  )}
                  {!accessContext.isExternal && isAdmin && (
                    <>
                      <Link href="/admin/analytics" className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3v18m4-12v12m4-6v6M7 13v8M3 21h18" />
                        </svg>
                        Workforce Analytics
                      </Link>
                      <Link href="/admin/metrics" className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                        </svg>
                        System Health
                      </Link>
                      <Link href="/admin/carers" className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Carer Directory
                      </Link>
                    </>
                  )}
                  <div className="border-t border-slate-100 mt-2 pt-2">
                    <button 
                      onClick={onSignOut}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 w-full"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-slate-100 transition-colors"
              aria-label="Toggle menu"
            >
              <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <nav className="md:hidden py-4 border-t border-slate-100">
            <div className="flex flex-col gap-1">
              {navItems.map((item) => {
                const isActive = isNavItemActive(pathname, item)
                
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors',
                      {
                        'bg-teal-50 text-teal-700': isActive,
                        'text-slate-600 hover:bg-slate-50': !isActive
                      }
                    )}
                  >
                    <span>{item.icon}</span>
                    {item.label}
                  </Link>
                )
              })}
            </div>
          </nav>
        )}
      </div>
    </header>
  )
}
