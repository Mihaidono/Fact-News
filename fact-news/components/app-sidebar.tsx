"use client";

import { NewspaperIcon, BookOpenIcon, LinkIcon } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface AppSidebarProps {
  activeSection: "feed" | "papers" | "sources";
  setActiveSection: (section: "feed" | "papers" | "sources") => void;
}

export function AppSidebar({
  activeSection,
  setActiveSection,
}: AppSidebarProps) {
  const menuItems = [
    {
      name: "Feed",
      icon: NewspaperIcon,
      value: "feed" as const,
    },
    {
      name: "Papers",
      icon: BookOpenIcon,
      value: "papers" as const,
    },
    {
      name: "Sources",
      icon: LinkIcon,
      value: "sources" as const,
    },
  ];

  return (
    <TooltipProvider delayDuration={0}>
      <Sidebar
        collapsible="icon"
        variant="sidebar"
        className="w-16 md:w-20 border-r"
      >
        <SidebarContent className="pt-10">
          <SidebarMenu className="flex flex-col items-center space-y-10">
            {menuItems.map((item) => (
              <SidebarMenuItem key={item.value} className="w-auto">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <SidebarMenuButton
                      isActive={activeSection === item.value}
                      onClick={() => setActiveSection(item.value)}
                      className={`
                        flex h-10 w-10 items-center justify-center rounded-full p-0
                        transition-colors duration-400
                        ${
                          activeSection === item.value
                            ? "bg-primary/10 text-primary"
                            : "hover:bg-primary/5 text-muted-foreground hover:text-foreground"
                        }
                      `}
                    >
                      <item.icon className="h-5 w-5" />
                    </SidebarMenuButton>
                  </TooltipTrigger>
                  <TooltipContent
                    side="right"
                    align="center"
                    className="font-medium"
                  >
                    {item.name}
                  </TooltipContent>
                </Tooltip>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
      </Sidebar>
    </TooltipProvider>
  );
}
