"use client";

import { Toaster } from "sonner";
import { useTheme } from "@/components/providers/ThemeProvider";

export function AppToaster() {
  const { dark } = useTheme();

  return (
    <Toaster
      position="bottom-right"
      theme={dark ? "dark" : "light"}
      closeButton
      expand={false}
      visibleToasts={3}
      gap={10}
      duration={3200}
      offset={{ bottom: 24, right: 24 }}
      mobileOffset={{ bottom: 18, right: 14 }}
      toastOptions={{
        classNames: {
          toast: "mq-toast",
          title: "mq-toast-title",
          description: "mq-toast-desc",
          closeButton: "mq-toast-close",
          success: "mq-toast-success",
          error: "mq-toast-error",
          warning: "mq-toast-warning",
          info: "mq-toast-info",
        },
      }}
    />
  );
}
