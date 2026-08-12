# TextArea

Auto-growing multiline text field with floating label, optional row cap, animated counter, and validation states.

## Exports

- `TextArea`
- `TextAreaProps`

## Key Props

- `label`, `hint`, `error`, `success`, `required`
- `minRows`: minimum visible rows, default `3`
- `maxRows`: maximum rows before internal scroll, default `6`
- `grow`: when `true`, ignore `maxRows` and keep expanding
- `maxLength`: hard character limit
- `warnAt`: fraction of `maxLength` where warning color starts, default `0.8`
- `minLength`: shows helper hint until the count is met
- `wrapClassName`: wrapper-level classes
- All standard multiline-safe `TextInputProps`

## Example

```tsx
import { TextArea } from "@/components/ui/textarea";

<TextArea
  label="Bio"
  placeholder="Tell us about yourself"
  value={bio}
  onChangeText={setBio}
  minRows={3}
  maxRows={6}
  minLength={20}
  maxLength={300}
  hint="Visible on your public profile"
/>;
```

## Notes

- Height animates with Reanimated as content grows.
- When content exceeds `maxRows`, the internal `TextInput` becomes scrollable.
- Counter fades in on focus and shifts to warning/error colors as the limit approaches.
