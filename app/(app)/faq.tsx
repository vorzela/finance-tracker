import { FaqScreen } from "@/components/ui/doc-screen";
import { FAQ_ITEMS } from "@/lib/legal";
import React from "react";

export default function Faq() {
  return (
    <FaqScreen title="FAQ" subtitle="Common questions" items={FAQ_ITEMS} />
  );
}
