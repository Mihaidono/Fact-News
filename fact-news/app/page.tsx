"use client"

import { useState } from "react"
import { Toaster } from "sonner"
import { AppSidebar } from "@/components/app-sidebar"
import { FeedContent } from "@/components/feed-content"
import { PapersContent } from "@/components/papers-content"
import { SourcesContent } from "@/components/sources-content"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

export default function Home() {
  const [activeSection, setActiveSection] = useState<"feed" | "papers" | "sources">("feed")

  return (
    <>
      <SidebarProvider>
        <AppSidebar activeSection={activeSection} setActiveSection={setActiveSection} />
        <SidebarInset>
          <div className="flex min-h-screen flex-col">
            {activeSection === "feed" && <FeedContent />}
            {activeSection === "papers" && <PapersContent />}
            {activeSection === "sources" && <SourcesContent />}
          </div>
        </SidebarInset>
      </SidebarProvider>

      {/* Sonner toast container - positioned at the top right */}
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: "var(--background)",
            color: "var(--foreground)",
            border: "1px solid var(--border)",
          },
        }}
      />
    </>
  )
}
