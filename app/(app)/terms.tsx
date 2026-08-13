import { DocScreen } from "@/components/ui/doc-screen";
import { TERMS_SECTIONS } from "@/lib/legal";
import React from "react";

export default function Terms() {
  return (
    <DocScreen
      title="Terms of use"
      subtitle="How Duo Wallet may be used"
      sections={TERMS_SECTIONS}
    />
  );
}
