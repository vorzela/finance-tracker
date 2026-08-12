/**
 * components/brand/logo.tsx
 *
 * The app mark as vector, so the auth and empty screens can show the brand at
 * any size without shipping another PNG. Geometry matches
 * `scripts/generate-icons.mjs` exactly.
 */

import React from "react";
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from "react-native-svg";

export interface LogoProps {
  size?: number;
  /** Draws the navy rounded-square behind the wallet, as on the home screen. */
  withBackdrop?: boolean;
  /** Wallet colour. Ignored when `withBackdrop` is set. */
  color?: string;
}

export function Logo({ size = 64, withBackdrop = true, color = "#ffffff" }: LogoProps) {
  const scale = withBackdrop ? 0.74 : 1;
  const offset = 512 * (1 - scale);

  return (
    <Svg width={size} height={size} viewBox="0 0 1024 1024">
      {withBackdrop && (
        <>
          <Defs>
            <LinearGradient id="logoBg" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#2f5ba8" />
              <Stop offset="0.55" stopColor="#1b3560" />
              <Stop offset="1" stopColor="#0d1c33" />
            </LinearGradient>
          </Defs>
          <Rect width={1024} height={1024} rx={228} fill="url(#logoBg)" />
        </>
      )}

      <Rect
        x={286 * scale + offset}
        y={(236 + 28) * scale + offset}
        width={286 * scale}
        height={206 * scale}
        rx={44 * scale}
        fill="#f5a623"
        origin={`${429 * scale + offset}, ${(339 + 28) * scale + offset}`}
        rotation={-15}
      />
      <Rect
        x={452 * scale + offset}
        y={(236 + 28) * scale + offset}
        width={286 * scale}
        height={206 * scale}
        rx={44 * scale}
        fill="#3db077"
        origin={`${595 * scale + offset}, ${(339 + 28) * scale + offset}`}
        rotation={15}
      />
      <Rect
        x={252 * scale + offset}
        y={(392 + 28) * scale + offset}
        width={520 * scale}
        height={372 * scale}
        rx={96 * scale}
        fill={withBackdrop ? "#ffffff" : color}
      />
      <Rect
        x={560 * scale + offset}
        y={(520 + 28) * scale + offset}
        width={196 * scale}
        height={124 * scale}
        rx={62 * scale}
        fill="#dfe7f5"
      />
      <Circle
        cx={658 * scale + offset}
        cy={(582 + 28) * scale + offset}
        r={30 * scale}
        fill="#0d1c33"
      />
    </Svg>
  );
}
