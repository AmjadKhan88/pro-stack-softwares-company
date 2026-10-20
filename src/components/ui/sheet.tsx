"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Sheet = Dialog.Root;
export const SheetTrigger = Dialog.Trigger;
export const SheetClose = Dialog.Close;

interface SheetContentProps extends React.ComponentProps<typeof Dialog.Content> {
  title: string;
}

/** Left-side drawer built on Radix Dialog: focus trap, Escape to close, labelled for screen readers. */
export function SheetContent({ title, className, children, ...props }: SheetContentProps) {
  return (
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50" />
      <Dialog.Content
        aria-describedby={undefined}
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[280px] max-w-[85vw] flex-col shadow-xl focus-visible:outline-none",
          className,
        )}
        {...props}
      >
        <Dialog.Title className="sr-only">{title}</Dialog.Title>
        <Dialog.Close
          className="focus-visible:ring-accent/25 absolute top-3 right-3 grid size-9 place-items-center rounded-md text-current opacity-70 hover:opacity-100 focus-visible:ring-4"
          aria-label="Close menu"
        >
          <X className="size-4" aria-hidden />
        </Dialog.Close>
        {children}
      </Dialog.Content>
    </Dialog.Portal>
  );
}
