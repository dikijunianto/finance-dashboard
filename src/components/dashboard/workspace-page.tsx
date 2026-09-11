"use client";
import { useState } from "react";
import {
  createPlannerItem,
  deletePlannerItem,
  updatePlannerItem,
} from "@/actions/planner";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DeleteConfirmation,
  MutationForm,
} from "@/components/ui/mutation-form";
type Item = { id: string; name: string; detail: string };
export function WorkspacePage({
  title,
  subtitle,
  items,
}: {
  title: string;
  subtitle: string;
  items: Item[];
}) {
  return (
    <div className="mx-auto max-w-6xl p-5 md:p-8">
      <header>
        <h1 className="text-3xl font-semibold">{title}</h1>
        <p className="mt-2 text-slate-600">{subtitle}</p>
      </header>
      <section className="mt-6 rounded-2xl border bg-white p-5">
        <div className="flex flex-wrap justify-between gap-3">
          <h2 className="font-semibold">Financial Notes</h2>
          <NoteDialog />
        </div>
        {items.length ? (
          items.map((item) => (
            <div
              key={item.id}
              className="mt-4 flex flex-wrap justify-between gap-3 border-t pt-4"
            >
              <div className="min-w-0">
                <p className="break-words text-sm">{item.name}</p>
                <p className="mt-1 text-xs text-slate-500">{item.detail}</p>
              </div>
              <div className="flex gap-3">
                <NoteDialog item={item} />
                <DeleteConfirmation
                  id={item.id}
                  name={item.name}
                  action={deletePlannerItem}
                />
              </div>
            </div>
          ))
        ) : (
          <p className="mt-4 text-sm text-slate-500">
            No financial notes yet. Keep reminders for your next money decision
            here.
          </p>
        )}
      </section>
    </div>
  );
}
function NoteDialog({ item }: { item?: Item }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="text-sm font-semibold text-emerald-700"
        >
          {item ? "Edit Note" : "Add Note"}
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {item ? "Edit Financial Note" : "Add Financial Note"}
          </DialogTitle>
        </DialogHeader>
        <MutationForm
          action={item ? updatePlannerItem : createPlannerItem}
          onSuccess={() => setOpen(false)}
        >
          {item && <input type="hidden" name="id" value={item.id} />}
          <input type="hidden" name="section" value="settings" />
          <label className="block text-sm">
            Financial note
            <textarea
              name="name"
              required
              maxLength={1000}
              defaultValue={item?.name ?? ""}
              className="mt-1 w-full rounded-lg border p-2"
            />
          </label>
          <label className="mt-3 block text-sm">
            Category
            <input
              name="detail"
              maxLength={120}
              defaultValue={item?.detail ?? ""}
              className="mt-1 w-full rounded-lg border p-2"
            />
          </label>
          <DialogFooter>
            <DialogClose type="button" className="rounded-xl border px-4 py-2">
              Cancel
            </DialogClose>
            <button
              type="submit"
              className="rounded-xl bg-emerald-700 px-4 py-2 text-white"
            >
              Save Note
            </button>
          </DialogFooter>
        </MutationForm>
      </DialogContent>
    </Dialog>
  );
}
