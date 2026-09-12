"use client";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;
export const DialogTitle = DialogPrimitive.Title;
export const DialogDescription = DialogPrimitive.Description;
export function DialogContent({ children }: { children: React.ReactNode }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-950/35" />
      <DialogPrimitive.Content
        aria-describedby={undefined}
        className="fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100%_-_2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
      >
        <DialogPrimitive.Close
          type="button"
          aria-label="Close dialog"
          className="absolute right-3 top-3 rounded-lg p-2 text-slate-500 hover:bg-slate-100"
        >
          <X size={18} />
        </DialogPrimitive.Close>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
export function DialogHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-5 pr-8 [&_h2]:text-lg [&_h2]:font-semibold">
      {children}
    </div>
  );
}
export function DialogFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-6 flex flex-wrap justify-end gap-2 border-t pt-5">
      {children}
    </div>
  );
}
