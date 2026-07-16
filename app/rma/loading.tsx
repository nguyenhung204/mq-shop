import { Container } from "@/components/ui/shared";
import { RmaListSkeleton } from "@/components/ui/Skeleton";

export default function RmaLoading() {
  return (
    <Container className="py-10 md:py-14">
      <RmaListSkeleton />
    </Container>
  );
}
