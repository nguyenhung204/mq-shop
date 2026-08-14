"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mq-container py-20 text-center">
      <h1 className="text-lg font-semibold">Something went wrong</h1>
      <p className="mt-2 text-sm text-mq-text-muted">
        {error.message || "An unexpected error occurred."}
      </p>
      <button type="button" className="mq-btn mq-btn-primary mt-6" onClick={() => reset()}>
        Try again
      </button>
    </div>
  );
}
