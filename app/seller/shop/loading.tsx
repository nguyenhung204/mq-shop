import { Container } from "@/components/ui/shared";
import { ShopCardSkeleton } from "@/components/ui/Skeleton";

export default function SellerShopLoading() {
  return (
    <Container className="py-10 max-w-xl">
      <ShopCardSkeleton />
    </Container>
  );
}
