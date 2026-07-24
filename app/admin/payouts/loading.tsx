import { Container } from "@/components/ui/shared";
import { AdminCardListSkeleton } from "@/components/ui/Skeleton";

export default function AdminPayoutsLoading() {
  return (
    <Container className="py-10">
      <AdminCardListSkeleton count={4} />
    </Container>
  );
}
