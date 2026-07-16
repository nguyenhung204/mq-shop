import { Container } from "@/components/ui/shared";
import { AdminCardListSkeleton } from "@/components/ui/Skeleton";

export default function AdminProductsLoading() {
  return (
    <Container className="py-10">
      <AdminCardListSkeleton />
    </Container>
  );
}
