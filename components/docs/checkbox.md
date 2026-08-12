# Checkbox

Custom checkbox with animated box colors, drawn SVG tick, press feedback, and inline error presentation.

## Exports

- `Checkbox`
- `CheckboxGroup`
- `CheckboxProps`
- `CheckboxGroupProps`

## Key Props

### Checkbox

- `checked`: current boolean value
- `onChange`: change handler receiving next boolean
- `label`: main text
- `hint`: secondary helper text
- `error`: error text shown below the label
- `disabled`: reduces emphasis and blocks interaction
- `className`: wrapper classes

### CheckboxGroup

- `label`: section heading
- `error`: group-level error text
- `children`: one or more checkboxes

## Example

```tsx
import { Checkbox, CheckboxGroup } from "@/components/ui/checkbox";

<CheckboxGroup label="Preferences">
  <Checkbox
    checked={terms}
    onChange={setTerms}
    label="I agree to the Terms"
    error={!terms && showErrors ? "You must accept the terms" : undefined}
  />
  <Checkbox
    checked={newsletter}
    onChange={setNewsletter}
    label="Subscribe to newsletter"
    hint="Weekly product updates"
  />
</CheckboxGroup>;
```

## Notes

- The tick is an SVG path animated with `strokeDashoffset`.
- Error state uses the design tokens from `global.css` and keeps the unchecked visual distinct from the checked state.
- Press-in feedback uses a spring scale animation.
