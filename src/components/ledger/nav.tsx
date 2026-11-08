"use client"

import * as React from "react"

export type ViewId =
  | "dashboard"
  | "accounts"
  | "journal"
  | "reports"
  | "settings"

interface NavContextValue {
  view: ViewId
  setView: (v: ViewId) => void
}

const NavContext = React.createContext<NavContextValue | null>(null)

export function NavProvider({
  children,
  value,
}: {
  children: React.ReactNode
  value: NavContextValue
}) {
  return <NavContext.Provider value={value}>{children}</NavContext.Provider>
}

export function useNav() {
  const ctx = React.useContext(NavContext)
  if (!ctx) throw new Error("useNav must be used within NavProvider")
  return ctx
}
