"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/lib/action-result";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog";
export function MutationForm({
  action,
  onSuccess,
  children,
  className,
}: {
  action: (data: FormData) => Promise<ActionResult>;
  onSuccess?: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  const router = useRouter();
  return (
    <form
      className={className}
      onSubmit={(event) => {
        event.preventDefault();
        if (inFlight.current) return;
        const data = new FormData(event.currentTarget);
        inFlight.current = true;
        setError("");
        startTransition(async () => {
          try {
            const result = await action(data);
            if (!result.success) {
              setError(result.error);
              return;
            }
            onSuccess?.();
            router.refresh();
          } catch {
            setError(
              "Could not confirm this change. Refresh to check its status before retrying.",
            );
          } finally {
            inFlight.current = false;
          }
        });
      }}
    >
      <fieldset
        disabled={pending}
        aria-busy={pending}
        className="min-w-0 disabled:opacity-60"
      >
        {children}
      </fieldset>
      {pending && (
        <p role="status" className="mt-2 text-sm text-slate-500">
          Saving…
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-rose-700">
          {error}
        </p>
      )}
    </form>
  );
}
export function DeleteConfirmation({
  id,
  name,
  action,
  paymentHistory = false,
}: {
  id: string;
  name: string;
  action: (data: FormData) => Promise<ActionResult>;
  paymentHistory?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" className="text-sm text-rose-600">
          Delete
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete “{name}”?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-slate-600">
          This action cannot be undone.
          {paymentHistory &&
            " Associated payment history will also be deleted."}
        </p>
        <MutationForm action={action} onSuccess={() => setOpen(false)}>
          <input type="hidden" name="id" value={id} />
          <DialogFooter>
            <DialogClose type="button" className="rounded-xl border px-4 py-2">
              Cancel
            </DialogClose>
            <button
              type="submit"
              className="rounded-xl bg-rose-600 px-4 py-2 text-white"
            >
              Delete
            </button>
          </DialogFooter>
        </MutationForm>
      </DialogContent>
    </Dialog>
  );
}
