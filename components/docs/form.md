# Form Wrappers

TanStack Form wrappers that bind the project UI components to `form.Field` in React Native.

## File

- `components/reusables/form.tsx`

## Exports

- `FormInput`
- `FormPassword`
- `FormTextArea`
- `FormCheckbox`

## What The Wrappers Handle

- Field state binding via `form.Field`
- Value updates through `field.handleChange`
- Blur events through `field.handleBlur`
- Error extraction from `field.state.meta.errors`
- Optional success messaging when the field is valid
- Optional sync or async field validators
- Optional `asyncDebounceMs`
- Optional `parseValue` and `formatValue` hooks for non-string field values

## Validation Support

Pass any TanStack Form field validators through the `validators` prop.

```tsx
validators={{
  onChange: ({ value }) =>
    !value ? "Email is required" : undefined,
  onBlur: ({ value }) =>
    !value.includes("@") ? "Enter a valid email" : undefined,
  onChangeAsyncDebounceMs: 500,
  onChangeAsync: async ({ value }) => {
    const taken = await api.emailExists(value);
    return taken ? "Email is already in use" : undefined;
  },
}}
```

## Example

```tsx
import { useForm } from "@tanstack/react-form";
import {
  FormCheckbox,
  FormInput,
  FormPassword,
  FormTextArea,
} from "@/components/reusables/form";

const form = useForm({
  defaultValues: {
    email: "",
    password: "",
    bio: "",
    acceptTerms: false,
  },
  onSubmit: async ({ value }) => {
    await saveProfile(value);
  },
});

<FormInput
  form={form}
  name="email"
  label="Email"
  keyboardType="email-address"
  autoCapitalize="none"
  validators={{
    onBlur: ({ value }) =>
      !value ? "Email is required" : !value.includes("@") ? "Invalid email" : undefined,
  }}
/>

<FormPassword
  form={form}
  name="password"
  label="Password"
  validators={{
    onChange: ({ value }) =>
      value.length < 8 ? "Minimum 8 characters" : undefined,
  }}
/>

<FormTextArea
  form={form}
  name="bio"
  label="Bio"
  minLength={20}
  maxLength={300}
/>

<FormCheckbox
  form={form}
  name="acceptTerms"
  label="I agree to the Terms"
  validators={{
    onSubmit: ({ value }) => (value ? undefined : "You must accept the terms"),
  }}
/>

<Button onPress={() => form.handleSubmit()}>
```

## Notes

- `hideErrorsUntilTouched` defaults to `true`.
- `successMessage` can be a string or a function receiving the field API.
- `parseValue` / `formatValue` are useful for numeric or transformed field values stored in the form.
