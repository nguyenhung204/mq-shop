import { Container } from "@/components/ui/shared";
import { Skeleton } from "@/components/ui/Skeleton";

export default function CheckoutLoading() {
  return (
    <Container className="py-10 md:py-16">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-10" aria-busy="true">
        <div className="space-y-4">
          <Skeleton className="h-64 w-full rounded-[var(--mq-radius-lg)]" />
        </div>
        <Skeleton className="h-80 w-full rounded-[var(--mq-radius-lg)]" />
      </div>
    </Container>
  );
}
