# Input

Animated text inputs for React Native with floating labels, focus/error/success states, and password visibility toggle.

## Exports

- `Input`
- `PasswordInput`
- `InputProps`

## Key Props

- `label`: floating label inside the field
- `hint`: helper text below the field
- `error`: error message below the field
- `success`: success message below the field
- `required`: appends `*` to the label
- `leadingNode`: icon or custom node on the left
- `trailingNode`: custom node on the right
- `wrapClassName`: wrapper-level classes
- All standard `TextInputProps`

## Example

```tsx
import { Input, PasswordInput } from "@/components/ui/input";
import { Envelope } from "phosphor-react-native";

<Input
  label="Email"
  placeholder="name@example.com"
  keyboardType="email-address"
  autoCapitalize="none"
  leadingNode={<Envelope size={18} color="#9ca3af" />}
  error={emailError}
  value={email}
  onChangeText={setEmail}
/>

<PasswordInput
  label="Password"
  placeholder="Enter your password"
  value={password}
  onChangeText={setPassword}
/>
```

## Notes

- Label animation uses Reanimated for `fontSize`, `translateY`, and color.
- The full container is pressable, so tapping padding or label focuses the field.
- `PasswordInput` stops event propagation on the eye toggle so the outer focus press does not interfere.
