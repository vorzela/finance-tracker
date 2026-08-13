/**
 * components/ui/doc-screen.tsx
 *
 * Simple scrollable document layout for Terms, Privacy, FAQ and Usage.
 */

import { Card, Section } from "@/components/ui/card";
import { Header, Screen, ScreenScroll } from "@/components/ui/screen";
import type { FaqItem, GuideSection } from "@/lib/legal";
import React from "react";
import { Text, View } from "react-native";

export function DocScreen({
  title,
  subtitle,
  sections,
}: {
  title: string;
  subtitle?: string;
  sections: GuideSection[];
}) {
  return (
    <Screen>
      <Header title={title} subtitle={subtitle} back />
      <ScreenScroll>
        {sections.map((section) => (
          <Section key={section.title} title={section.title}>
            <Card>
              <Text className="text-sm leading-6 text-muted">{section.body}</Text>
            </Card>
          </Section>
        ))}
      </ScreenScroll>
    </Screen>
  );
}

export function FaqScreen({
  title,
  subtitle,
  items,
}: {
  title: string;
  subtitle?: string;
  items: FaqItem[];
}) {
  return (
    <Screen>
      <Header title={title} subtitle={subtitle} back />
      <ScreenScroll>
        {items.map((item) => (
          <Card key={item.q} className="gap-2">
            <Text className="text-base font-semibold text-ink">{item.q}</Text>
            <Text className="text-sm leading-6 text-muted">{item.a}</Text>
          </Card>
        ))}
        <View className="h-2" />
      </ScreenScroll>
    </Screen>
  );
}
