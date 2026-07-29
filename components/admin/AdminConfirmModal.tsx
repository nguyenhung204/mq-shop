"use client";

import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

type AdminConfirmModalProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  tone?: "danger" | "warn" | "primary";
  busy?: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
};

export function AdminConfirmModal(props: AdminConfirmModalProps) {
  return <ConfirmDialog {...props} />;
}
