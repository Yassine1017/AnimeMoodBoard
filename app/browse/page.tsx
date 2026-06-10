import { Suspense } from "react";

import { BrowseClient } from "@/components/browse-client";
import { LoadingState } from "@/components/loading-state";

export default function BrowsePage() {
  return (
    <Suspense fallback={<LoadingState label="Loading browse" />}>
      <BrowseClient />
    </Suspense>
  );
}
