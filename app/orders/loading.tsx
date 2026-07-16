import { Container } from "@/components/ui/shared";
import { OrderListSkeleton } from "@/components/ui/Skeleton";

export default function OrdersLoading() {
  return (
    <Container className="py-10 md:py-14">
      <OrderListSkeleton />
    </Container>
  );
}
