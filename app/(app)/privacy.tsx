import { DocScreen } from "@/components/ui/doc-screen";
import { PRIVACY_SECTIONS } from "@/lib/legal";
import React from "react";

export default function Privacy() {
  return (
    <DocScreen
      title="Privacy policy"
      subtitle="What we store and why"
      sections={PRIVACY_SECTIONS}
    />
  );
}
