import { Container } from "@/components/ui/shared";
import { AdminCardListSkeleton } from "@/components/ui/Skeleton";

export default function SellerLandingCostLoading() {
  return (
    <Container className="py-6">
      <AdminCardListSkeleton count={2} />
    </Container>
  );
}
