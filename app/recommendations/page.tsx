import { RecommendationsClient } from "@/components/recommendations-client";

type RecommendationsPageProps = {
  searchParams: Promise<{
    mood?: string;
  }>;
};

export default async function RecommendationsPage({
  searchParams,
}: RecommendationsPageProps) {
  const params = await searchParams;
  const mood = params.mood?.trim() || "cozy slice of life";

  return <RecommendationsClient mood={mood} />;
}
