import { DocScreen } from "@/components/ui/doc-screen";
import { USAGE_SECTIONS } from "@/lib/legal";
import React from "react";

export default function UsageGuide() {
  return (
    <DocScreen
      title="Usage guide"
      subtitle="Get the most from Duo Wallet"
      sections={USAGE_SECTIONS}
    />
  );
}
