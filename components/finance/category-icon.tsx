/**
 * components/finance/category-icon.tsx
 *
 * Maps the `icon` key on a category to a Phosphor glyph. Categories are data
 * (`lib/categories.ts`), icons are components, and this is the one place the
 * two meet.
 */

import type { CategoryIcon } from "@/lib/categories";
import { getCategory } from "@/lib/categories";
import { IconTile } from "@/components/ui/card";
import {
  ArrowsLeftRightIcon,
  BabyIcon,
  BagIcon,
  BankIcon,
  BasketIcon,
  BriefcaseIcon,
  BusIcon,
  ChartLineUpIcon,
  CoinsIcon,
  DeviceMobileIcon,
  DropIcon,
  FilmSlateIcon,
  FirstAidKitIcon,
  ForkKnifeIcon,
  GasPumpIcon,
  GiftIcon,
  GraduationCapIcon,
  HandshakeIcon,
  HouseIcon,
  LeafIcon,
  LightningIcon,
  MoneyIcon,
  PackageIcon,
  PiggyBankIcon,
  PopcornIcon,
  ReceiptIcon,
  StorefrontIcon,
  TagIcon,
  ToolboxIcon,
  UserIcon,
  WalletIcon,
  WrenchIcon,
  type Icon,
  type IconProps,
} from "phosphor-react-native";
import React from "react";

const GLYPHS: Record<CategoryIcon, Icon> = {
  basket: BasketIcon,
  fork: ForkKnifeIcon,
  snack: PopcornIcon,
  bus: BusIcon,
  fuel: GasPumpIcon,
  phone: DeviceMobileIcon,
  bolt: LightningIcon,
  drop: DropIcon,
  house: HouseIcon,
  health: FirstAidKitIcon,
  school: GraduationCapIcon,
  baby: BabyIcon,
  film: FilmSlateIcon,
  bag: BagIcon,
  person: UserIcon,
  tools: ToolboxIcon,
  piggy: PiggyBankIcon,
  receipt: ReceiptIcon,
  gift: GiftIcon,
  coins: CoinsIcon,
  briefcase: BriefcaseIcon,
  store: StorefrontIcon,
  refund: MoneyIcon,
  transfer: ArrowsLeftRightIcon,
  cash: WalletIcon,
  tag: TagIcon,
  handshake: HandshakeIcon,
  plant: LeafIcon,
  chart: ChartLineUpIcon,
  wrench: WrenchIcon,
  package: PackageIcon,
};

export interface CategoryIconProps {
  categoryId: string;
  size?: number;
  /** Overrides the category's own colour. */
  color?: string;
  weight?: IconProps["weight"];
}

export function CategoryGlyph({
  categoryId,
  size = 20,
  color,
  weight = "duotone",
}: CategoryIconProps) {
  const category = getCategory(categoryId);
  const Glyph = GLYPHS[category.icon] ?? TagIcon;
  return <Glyph size={size} color={color ?? category.color} weight={weight} />;
}

/** The glyph inside its tinted tile, as used in every transaction row. */
export function CategoryBadge({
  categoryId,
  size = 40,
  glyphSize,
}: {
  categoryId: string;
  size?: number;
  glyphSize?: number;
}) {
  const category = getCategory(categoryId);

  return (
    <IconTile color={category.color} size={size}>
      <CategoryGlyph categoryId={categoryId} size={glyphSize ?? Math.round(size * 0.5)} />
    </IconTile>
  );
}

/** Account types share the icon vocabulary but are not categories. */
export const ACCOUNT_GLYPHS = {
  cash: WalletIcon,
  bank: BankIcon,
  mobile: DeviceMobileIcon,
  card: MoneyIcon,
} as const;
