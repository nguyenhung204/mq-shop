import { Container } from "@/components/ui/shared";
import { RmaListSkeleton } from "@/components/ui/Skeleton";

export default function SellerRmaLoading() {
  return (
    <Container className="py-10">
      <RmaListSkeleton />
    </Container>
  );
}
