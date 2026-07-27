import { Container } from "@/components/ui/shared";
import { AdminCardListSkeleton } from "@/components/ui/Skeleton";

export default function AdminSettlementsLoading() {
  return (
    <Container className="py-10">
      <AdminCardListSkeleton count={6} />
    </Container>
  );
}
