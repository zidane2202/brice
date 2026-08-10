"use client";

import { useRef, useState, useTransition, type FormHTMLAttributes, type ReactNode } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";

type ConfirmConfig = {
  title: string;
  description?: string;
  confirmLabel?: string;
  tone?: "default" | "danger";
};

type Props = Omit<FormHTMLAttributes<HTMLFormElement>, "action"> & {
  action: (formData: FormData) => Promise<unknown>;
  successMessage?: string;
  errorMessage?: string;
  confirm?: ConfirmConfig;
  onSuccess?: () => void;
  children: ReactNode;
};

export function ActionForm({
  action,
  successMessage = "Action réussie",
  errorMessage = "Action impossible",
  confirm,
  onSuccess,
  children,
  ...formProps
}: Props) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const pendingData = useRef<FormData | null>(null);

  function run(formData: FormData) {
    const loadingId = toast.loading("Chargement…");
    startTransition(async () => {
      try {
        await action(formData);
        toast.dismiss(loadingId);
        toast.success(successMessage);
        onSuccess?.();
      } catch (error) {
        toast.dismiss(loadingId);
        toast.error(errorMessage, error instanceof Error ? error.message : undefined);
      }
    });
  }

  return (
    <>
      <form
        {...formProps}
        action={(formData) => {
          if (confirm) {
            pendingData.current = formData;
            setConfirmOpen(true);
            return;
          }
          run(formData);
        }}
      >
        <fieldset disabled={pending} style={{ border: 0, margin: 0, padding: 0, minInlineSize: 0, display: "contents" }}>
          {children}
        </fieldset>
      </form>
      {confirm ? (
        <ConfirmDialog
          open={confirmOpen}
          title={confirm.title}
          description={confirm.description}
          confirmLabel={confirm.confirmLabel}
          tone={confirm.tone}
          pending={pending}
          onCancel={() => {
            setConfirmOpen(false);
            pendingData.current = null;
          }}
          onConfirm={() => {
            const data = pendingData.current;
            setConfirmOpen(false);
            pendingData.current = null;
            if (data) run(data);
          }}
        />
      ) : null}
    </>
  );
}
