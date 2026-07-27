import { Container } from "@/components/ui/shared";
import { AdminCardListSkeleton } from "@/components/ui/Skeleton";

export default function AdminLandingCostLoading() {
  return (
    <Container className="py-10">
      <AdminCardListSkeleton count={2} />
    </Container>
  );
}
