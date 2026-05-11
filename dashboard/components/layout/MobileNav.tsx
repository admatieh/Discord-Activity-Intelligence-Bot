"use client"

import { useState } from "react"
import { Menu, Bot } from "lucide-react"
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { AppSidebar } from "./AppSidebar"
import { Button } from "@/components/ui/button"

export function MobileNav() {
  const [open, setOpen] = useState(false)

  return (
    <div className="md:hidden flex items-center gap-3 border-b border-border px-4 py-3 bg-card shrink-0">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
            <Menu className="h-5 w-5 text-foreground" />
            <span className="sr-only">Toggle navigation menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-60 p-0 border-r-0 bg-sidebar">
          <SheetTitle className="sr-only">Navigation Drawer</SheetTitle>
          <SheetDescription className="sr-only">Instructor workspace navigation</SheetDescription>
          <AppSidebar className="w-full border-r-0" onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
      <div className="flex items-center gap-2 min-w-0">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary shrink-0">
          <Bot className="h-3.5 w-3.5 text-primary-foreground" />
        </div>
        <p className="text-sm font-semibold text-foreground truncate">
          Instructor Workspace
        </p>
      </div>
    </div>
  )
}
