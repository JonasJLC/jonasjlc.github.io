import * as React from "react"
import { DropdownMenu } from "radix-ui"
import { cn } from "@/components/ferie/lib/utils"

/** A small floating menu of actions. */
const Menu = DropdownMenu.Root
const MenuTrigger = DropdownMenu.Trigger

function MenuContent({ className, ...props }: React.ComponentProps<typeof DropdownMenu.Content>) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        sideOffset={6}
        align="start"
        className={cn(
          "z-50 min-w-48 rounded-xl border bg-popover p-1 text-popover-foreground shadow-[0_12px_32px_rgba(0,0,0,.14)] data-[state=open]:animate-[fade-in_.12s_ease-out]",
          className
        )}
        {...props}
      />
    </DropdownMenu.Portal>
  )
}

function MenuItem({ className, ...props }: React.ComponentProps<typeof DropdownMenu.Item>) {
  return (
    <DropdownMenu.Item
      className={cn(
        "flex h-10 cursor-default items-center gap-2.5 rounded-lg px-2.5 text-sm outline-none select-none data-[highlighted]:bg-accent md:h-9 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

function MenuLabel({ className, ...props }: React.ComponentProps<typeof DropdownMenu.Label>) {
  return <DropdownMenu.Label className={cn("px-2.5 pt-2 pb-1 text-xs text-muted-foreground", className)} {...props} />
}

export { Menu, MenuTrigger, MenuContent, MenuItem, MenuLabel }
