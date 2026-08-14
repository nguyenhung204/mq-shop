"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm opacity-70">
          {error.message || "An unexpected error occurred."}
        </p>
        <button
          type="button"
          className="mt-6 rounded border px-4 py-2 text-sm"
          onClick={() => reset()}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
