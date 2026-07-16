import { Container } from "@/components/ui/shared";
import { OrderListSkeleton } from "@/components/ui/Skeleton";

export default function SellerOrdersLoading() {
  return (
    <Container className="py-10">
      <OrderListSkeleton />
    </Container>
  );
}
