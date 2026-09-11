"use client";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
export const Dialog=DialogPrimitive.Root; export const DialogTrigger=DialogPrimitive.Trigger; export const DialogClose=DialogPrimitive.Close;
export function DialogContent({children}:{children:React.ReactNode}){return <DialogPrimitive.Portal><DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-950/30"/><DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-xl"><DialogPrimitive.Close className="absolute right-4 top-4 text-slate-400"><X size={18}/></DialogPrimitive.Close>{children}</DialogPrimitive.Content></DialogPrimitive.Portal>}
export const DialogTitle=DialogPrimitive.Title; export const DialogDescription=DialogPrimitive.Description;
export function DialogHeader({children}:{children:React.ReactNode}){return <div className="mb-5 pr-6">{children}</div>}; export function DialogFooter({children}:{children:React.ReactNode}){return <div className="mt-6 flex justify-end gap-2">{children}</div>}
