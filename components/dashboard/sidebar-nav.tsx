"use client"

import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Eye,
  MapPin,
  MessageCircle,
  Settings,
  User,
  Backpack,
} from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "vision", label: "Vision", icon: Eye },
  { id: "location", label: "Location", icon: MapPin },
  { id: "interaction", label: "Interaction", icon: MessageCircle },
]

interface SidebarNavProps {
  activeView: string
  onViewChange: (view: string) => void
}

export function SidebarNav({ activeView, onViewChange }: SidebarNavProps) {
  return (
    <TooltipProvider delayDuration={0}>
      {/* <!-- SECTION:SIDEBAR --> */}
      <aside className="fixed left-0 top-0 z-40 flex h-screen w-16 flex-col items-center border-r border-border bg-card py-6">
        {/* Logo */}
        <div className="mb-8 flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
          <Backpack className="h-5 w-5 text-primary-foreground" />
        </div>

        {/* Navigation */}
        <nav className="flex flex-1 flex-col items-center gap-2">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = activeView === item.id
            return (
              <Tooltip key={item.id}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => onViewChange(item.id)}
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-200",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                    aria-label={item.label}
                  >
                    <Icon className="h-5 w-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  <p>{item.label}</p>
                </TooltipContent>
              </Tooltip>
            )
          })}
        </nav>

        {/* Bottom Actions */}
        <div className="flex flex-col items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                aria-label="Settings"
              >
                <Settings className="h-5 w-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              <p>Settings</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent">
                <User className="h-4 w-4 text-accent-foreground" />
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              <p>Profile</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </aside>
      {/* <!-- /SECTION:SIDEBAR --> */}
    </TooltipProvider>
  )
}
