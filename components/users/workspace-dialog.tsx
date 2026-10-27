"use client";

import { useState } from "react";
import { toast } from "sonner";
import { UserAvatar } from "@/components/users/user-avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ROLE_LABEL } from "@/lib/roles";
import { useStore } from "@/lib/store";
import type { Workspace } from "@/lib/types";

/** Create a workspace and choose who's in it, or rename an existing one. */
export function WorkspaceDialog({
  workspace,
  onClose,
  onCreated,
}: {
  workspace?: Workspace;
  onClose: () => void;
  onCreated?: (ws: Workspace) => void;
}) {
  const {
    users,
    workspaces,
    createWorkspace,
    updateWorkspace,
    setWorkspaceMembers,
  } = useStore();
  const [name, setName] = useState(workspace?.name ?? "");
  const [description, setDescription] = useState(workspace?.description ?? "");
  const [memberIds, setMemberIds] = useState<string[]>(() =>
    workspace
      ? users
          .filter(
            (u) => u.role !== "admin" && u.workspaceIds.includes(workspace.id),
          )
          .map((u) => u.id)
      : [],
  );
  const [touched, setTouched] = useState(false);

  const taken = workspaces.some(
    (w) =>
      w.id !== workspace?.id &&
      w.name.toLowerCase() === name.trim().toLowerCase(),
  );
  const error = !name.trim()
    ? "Give the workspace a name"
    : taken
      ? "A workspace with this name already exists"
      : "";
  const candidates = users.filter(
    (u) => u.role !== "admin" && u.status !== "deactivated",
  );
  // Unticked users for whom this is their only workspace.
  const losingAll = workspace
    ? candidates.filter(
        (u) =>
          !memberIds.includes(u.id) &&
          u.workspaceIds.length === 1 &&
          u.workspaceIds[0] === workspace.id,
      )
    : [];
  const adminCount = users.filter(
    (u) => u.role === "admin" && u.status !== "deactivated",
  ).length;

  const submit = () => {
    if (error) {
      setTouched(true);
      return;
    }
    if (workspace) {
      updateWorkspace(workspace.id, {
        name: name.trim(),
        description: description.trim(),
      });
      // Deactivated users aren't listed, so they keep whatever access they had.
      const keptDeactivated = users
        .filter(
          (u) =>
            u.status === "deactivated" && u.workspaceIds.includes(workspace.id),
        )
        .map((u) => u.id);
      setWorkspaceMembers(workspace.id, [...memberIds, ...keptDeactivated]);
      toast.success(`Saved ${name.trim()}`);
    } else {
      const ws = createWorkspace({ name, description, memberIds });
      toast.success(`Created ${ws.name}`);
      onCreated?.(ws);
    }
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg!">
        <DialogHeader>
          <DialogTitle>
            {workspace ? `Edit ${workspace.name}` : "Create workspace"}
          </DialogTitle>
          <DialogDescription>
            {workspace
              ? "Rename it, or change which Sales and Management users can open it."
              : "A separate set of ICPs, leads, prompts and settings. Nothing is shared between workspaces."}
          </DialogDescription>
        </DialogHeader>
        <form
          id="workspace-form"
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="ws-name">Name</Label>
            <Input
              id="ws-name"
              value={name}
              autoFocus
              placeholder="e.g. Agency clients"
              aria-invalid={(touched && !!error) || undefined}
              onBlur={() => setTouched(true)}
              onChange={(e) => setName(e.target.value)}
            />
            {touched && error && (
              <p className="text-xs text-destructive">{error}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ws-description">
              Description{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </Label>
            <Textarea
              id="ws-description"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium">Members</legend>
            <p className="text-[13px] text-muted-foreground">
              {adminCount === 1 ? "The one admin can" : `All ${adminCount} admins can`} open every workspace. Sales and
              Management users only see it if ticked here.
            </p>
            {candidates.length ? (
              <div className="max-h-56 divide-y divide-rule overflow-y-auto rounded-md border">
                {candidates.map((u) => (
                  <label
                    key={u.id}
                    className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-muted/50"
                  >
                    <Checkbox
                      checked={memberIds.includes(u.id)}
                      onCheckedChange={(v) =>
                        setMemberIds((ids) =>
                          v === true
                            ? [...ids, u.id]
                            : ids.filter((id) => id !== u.id),
                        )
                      }
                    />
                    <UserAvatar name={u.name} className="size-6 text-[10px]" />
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {u.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {ROLE_LABEL[u.role]}
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-muted-foreground">
                No other users yet. Invite them from the Users tab.
              </p>
            )}
            {losingAll.length > 0 && (
              <p className="text-[13px] text-warning">
                {losingAll.map((u) => u.name).join(", ")}{" "}
                {losingAll.length === 1 ? "has" : "have"} no other workspace and
                won&apos;t be able to open anything.
              </p>
            )}
          </fieldset>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="workspace-form">
            {workspace ? "Save changes" : "Create workspace"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
