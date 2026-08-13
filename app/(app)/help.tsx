/**
 * app/(app)/help.tsx
 *
 * Hub for usage, FAQ and legal documents.
 */

import { Card, IconTile, Row, Section } from "@/components/ui/card";
import { Header, Screen, ScreenScroll } from "@/components/ui/screen";
import { useRouter } from "expo-router";
import {
  BookOpenTextIcon,
  QuestionIcon,
  ScrollIcon,
  ShieldCheckIcon,
} from "phosphor-react-native";
import React from "react";
import { Text } from "react-native";

export default function Help() {
  const router = useRouter();

  return (
    <Screen>
      <Header title="Help" subtitle="Guides and legal" back />
      <ScreenScroll>
        <Card>
          <Text className="text-sm leading-6 text-muted">
            Paste M-Pesa SMS when adding an entry to fill amount, fee, code and
            time automatically. Fuliza is debt; M-Shwari / Ziidi are savings;
            Pochi is business — you still choose the category.
          </Text>
        </Card>

        <Section title="Guides">
          <Card flush>
            <Row
              leading={
                <IconTile color="#1e3a5f">
                  <BookOpenTextIcon size={20} color="#1e3a5f" weight="duotone" />
                </IconTile>
              }
              title="Usage guide"
              subtitle="Setup, household, M-Pesa, reports"
              chevron
              onPress={() => router.push("/usage")}
            />
            <Row
              leading={
                <IconTile color="#0e7490">
                  <QuestionIcon size={20} color="#0e7490" weight="duotone" />
                </IconTile>
              }
              title="FAQ"
              subtitle="Fuliza doubles, SMS, fees, themes"
              chevron
              last
              onPress={() => router.push("/faq")}
            />
          </Card>
        </Section>

        <Section title="Legal">
          <Card flush>
            <Row
              leading={
                <IconTile color="#4b5563">
                  <ScrollIcon size={20} color="#4b5563" weight="duotone" />
                </IconTile>
              }
              title="Terms of use"
              subtitle="Service rules and limits"
              chevron
              onPress={() => router.push("/terms")}
            />
            <Row
              leading={
                <IconTile color="#166b3f">
                  <ShieldCheckIcon size={20} color="#166b3f" weight="duotone" />
                </IconTile>
              }
              title="Privacy policy"
              subtitle="Data, SMS and sharing"
              chevron
              last
              onPress={() => router.push("/privacy")}
            />
          </Card>
        </Section>
      </ScreenScroll>
    </Screen>
  );
}
