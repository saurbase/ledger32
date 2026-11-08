"use client"

import { cn } from "@/lib/utils"

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("size-8", className)}
      aria-hidden="true"
    >
      <rect x="4" y="4" width="40" height="40" rx="9" className="fill-foreground" />
      {/* book spine */}
      <path
        d="M14 13h11v22H15a1 1 0 0 1-1-1V13Z"
        className="fill-background"
      />
      <path d="M25 13h9a1 1 0 0 1 1 1v20a1 1 0 0 1-1 1H25V13Z" className="fill-background" opacity="0.75" />
      {/* orange accent pages */}
      <rect x="16" y="17" width="6" height="2.2" rx="1" className="fill-primary" />
      <rect x="16" y="22" width="6" height="2.2" rx="1" className="fill-primary" opacity="0.7" />
      <rect x="27" y="17" width="5" height="2.2" rx="1" className="fill-primary" opacity="0.55" />
      <rect x="27" y="22" width="5" height="2.2" rx="1" className="fill-primary" opacity="0.4" />
      {/* orange equity line */}
      <rect x="16" y="29" width="14" height="2.6" rx="1.3" className="fill-primary" />
    </svg>
  )
}
