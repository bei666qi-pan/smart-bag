"use client"

import { useState } from "react"
import { SidebarNav } from "@/components/dashboard/sidebar-nav"
import { TopBar } from "@/components/dashboard/top-bar"
import { BentoOverview } from "@/components/dashboard/bento-overview"
import { VisionSection } from "@/components/dashboard/vision-section"
import { LocationSection } from "@/components/dashboard/location-section"
import { InteractionSection } from "@/components/dashboard/interaction-section"

export default function Home() {
  const [activeView, setActiveView] = useState("dashboard")

  return (
    <div className="flex h-screen bg-secondary">
      {/* Sidebar */}
      <SidebarNav activeView={activeView} onViewChange={setActiveView} />

      {/* Main Content Area */}
      <div className="ml-16 flex flex-1 flex-col overflow-hidden">
        {/* Top Bar */}
        <TopBar activeView={activeView} />

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {activeView === "dashboard" && (
            <BentoOverview onNavigate={setActiveView} />
          )}
          {activeView === "vision" && <VisionSection />}
          {activeView === "location" && <LocationSection />}
          {activeView === "interaction" && <InteractionSection />}
        </main>
      </div>
    </div>
  )
}
