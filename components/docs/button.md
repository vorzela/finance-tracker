# Button

Premium React Native button with Reanimated press feedback, haptics, loading state, and icon support.

## Exports

- `Button`
- `Variant`: `primary | secondary | ghost | danger | success`
- `Size`: `sm | md | lg`
- `HapticStyle`: `light | medium | heavy | none`

## Key Props

- `variant`: visual tone, defaults to `primary`
- `size`: sizing preset, defaults to `md`
- `outline`: outline mode for non-ghost variants
- `loading`: disables the button and shows spinner
- `disabled`: blocks interaction
- `icon`: leading icon
- `trailingIcon`: trailing icon
- `haptic`: haptic intensity
- `onDoublePress`: second-tap callback inside debounce window
- `onLongPress`: long press callback
- `className`: container classes
- `textClassName`: text classes

## Example

```tsx
import { Button } from "@/components/ui/button";
import { ArrowRightIcon } from "phosphor-react-native";

<Button
  variant="primary"
  size="lg"
  haptic="medium"
  trailingIcon={<ArrowRightIcon size={18} color="#fff" />}
  onPress={() => void submit()}
>
  Continue
</Button>;
```

## Notes

- `loading` implicitly disables presses.
- `ghost` uses minimal chrome and text-only emphasis.
- Icons inherit whatever color you pass to the icon component.
