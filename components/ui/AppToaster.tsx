"use client";

import { Toaster } from "sonner";

export function AppToaster() {
  return (
    <Toaster
      position="top-center"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast: "mq-toast",
          title: "text-sm font-medium",
          description: "text-xs",
        },
      }}
    />
  );
}
