import { Container } from "@/components/ui/shared";
import { TableSkeleton } from "@/components/ui/Skeleton";

export default function SellerProductsLoading() {
  return (
    <Container className="py-10">
      <TableSkeleton rows={6} cols={5} />
    </Container>
  );
}
