import { Container } from "@/components/ui/shared";
import { WalletSkeleton } from "@/components/ui/Skeleton";

export default function WalletLoading() {
  return (
    <Container className="py-10 md:py-14 max-w-3xl mx-auto">
      <WalletSkeleton />
    </Container>
  );
}
