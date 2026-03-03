// app/(dashboard)/layout.tsx
"use client"

import { SidebarNav } from "@/components/dashboard/sidebar-nav"
import { TopBar } from "@/components/dashboard/top-bar"
import { useMqttClient } from "@/hooks/useMqttClient"
import { Toaster } from "@/components/ui/sonner"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Initialize MQTT connection at dashboard root
  useMqttClient()

  return (
    <div className="flex h-screen bg-secondary">
      <SidebarNav />
      <div className="ml-16 flex flex-1 flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
      <Toaster />
    </div>
  )
}
