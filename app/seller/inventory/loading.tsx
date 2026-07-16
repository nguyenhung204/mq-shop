import { Container } from "@/components/ui/shared";
import { AdminCardListSkeleton } from "@/components/ui/Skeleton";

export default function SellerInventoryLoading() {
  return (
    <Container className="py-10">
      <AdminCardListSkeleton count={3} />
    </Container>
  );
}
