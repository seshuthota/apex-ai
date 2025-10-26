"use client";

import { useState } from "react";
import { CompetitionSidebar } from "./CompetitionSidebar";
import type { RunSummary } from "./types";

type CompetitionSidebarContainerProps = {
  runs: RunSummary[];
  currentRunId: string | null;
};

export function CompetitionSidebarContainer({
  runs,
  currentRunId,
}: CompetitionSidebarContainerProps) {
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const effectiveSelectedRunId =
    selectedRunId && runs.some(run => run.id === selectedRunId)
      ? selectedRunId
      : runs[0]?.id ?? null;

  return (
    <CompetitionSidebar
      runs={runs}
      selectedRunId={effectiveSelectedRunId}
      currentRunId={currentRunId}
      loadingHistory={false}
      loadingDetail={false}
      running={currentRunId !== null}
      onSelectRun={setSelectedRunId}
      onRefresh={() => {
        // Native refresh will refetch data when the page reloads.
      }}
    />
  );
}
