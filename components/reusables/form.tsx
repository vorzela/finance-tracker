/**
 * components/reusable/form.tsx
 *
 * TanStack Form (@tanstack/react-form) field wrappers for React Native.
 *
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │ FormInput     — form.Field + Input (text, email, etc.)               │
 * │ FormPassword  — form.Field + PasswordInput                           │
 * │ FormTextArea  — form.Field + TextArea                                │
 * │ FormCheckbox  — form.Field + Checkbox                                │
 * └──────────────────────────────────────────────────────────────────────┘
 *
 * Usage:
 *   const form = useForm({
 *     defaultValues: { email: '', password: '', rememberMe: false },
 *     onSubmit: async ({ value }) => { ... },
 *   })
 *
 *   <FormInput form={form} name="email" label="Email" required />
 *   <FormPassword form={form} name="password" label="Password" />
 *   <FormCheckbox form={form} name="rememberMe" label="Remember me" />
 */

import { Checkbox, type CheckboxProps } from "@/components/ui/checkbox";
import { Input, PasswordInput, type InputProps } from "@/components/ui/input";
import { TextArea, type TextAreaProps } from "@/components/ui/textarea";
import React from "react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyForm = any;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyField = any;

type ValidationResult = string | undefined;

interface FormFieldBaseProps<TValue> {
  form: AnyForm;
  name: string;
  validators?: Record<string, unknown>;
  asyncDebounceMs?: number;
  defaultValue?: TValue;
  parseValue?: (value: string, field: AnyField) => TValue;
  formatValue?: (value: TValue, field: AnyField) => string;
  hideErrorsUntilTouched?: boolean;
  successMessage?: string | ((field: AnyField) => ValidationResult);
  onValueChange?: (value: TValue, field: AnyField) => void;
}

type FormInputProps = FormFieldBaseProps<string> &
  Omit<
    InputProps,
    "value" | "defaultValue" | "onChangeText" | "error" | "success"
  >;

type FormPasswordProps = FormFieldBaseProps<string> &
  Omit<
    InputProps,
    | "value"
    | "defaultValue"
    | "onChangeText"
    | "error"
    | "success"
    | "secureTextEntry"
    | "trailingNode"
  >;

type FormTextAreaProps = FormFieldBaseProps<string> &
  Omit<
    TextAreaProps,
    "value" | "defaultValue" | "onChangeText" | "error" | "success"
  >;

type FormCheckboxProps = Omit<
  CheckboxProps,
  "checked" | "onChange" | "error"
> & {
  form: AnyForm;
  name: string;
  validators?: Record<string, unknown>;
  asyncDebounceMs?: number;
  defaultValue?: boolean;
  hideErrorsUntilTouched?: boolean;
  onValueChange?: (value: boolean, field: AnyField) => void;
};

function coerceFieldValueToString(value: unknown) {
  if (value === null || value === undefined) return "";
  return typeof value === "string" ? value : String(value);
}

function normalizeValidationMessage(error: unknown): ValidationResult {
  if (!error) return undefined;

  if (typeof error === "string") {
    return error;
  }

  if (Array.isArray(error)) {
    for (const entry of error) {
      const message = normalizeValidationMessage(entry);
      if (message) return message;
    }
    return undefined;
  }

  if (typeof error === "object") {
    if ("message" in error && typeof error.message === "string") {
      return error.message;
    }

    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }

  return String(error);
}

function getFieldError(field: AnyField, hideErrorsUntilTouched: boolean) {
  const meta = field.state.meta;
  const shouldHide =
    hideErrorsUntilTouched &&
    !meta.isTouched &&
    !meta.isBlurred &&
    !meta.isDirty;

  if (shouldHide) return undefined;

  return normalizeValidationMessage(meta.errors);
}

function getFieldSuccess(
  field: AnyField,
  error: ValidationResult,
  successMessage?: string | ((field: AnyField) => ValidationResult),
) {
  if (error) return undefined;
  if (!field.state.meta.isDirty && !field.state.meta.isTouched)
    return undefined;
  if (!field.state.meta.isValid) return undefined;
  if (!successMessage) return undefined;

  return typeof successMessage === "function"
    ? successMessage(field)
    : successMessage;
}

export function FormInput({
  form,
  name,
  validators,
  asyncDebounceMs,
  defaultValue,
  parseValue,
  formatValue,
  hideErrorsUntilTouched = true,
  successMessage,
  onValueChange,
  onBlur,
  ...props
}: FormInputProps) {
  return (
    <form.Field
      name={name}
      validators={validators}
      asyncDebounceMs={asyncDebounceMs}
      defaultValue={defaultValue}
    >
      {(field: AnyField) => {
        const error = getFieldError(field, hideErrorsUntilTouched);
        const success = getFieldSuccess(field, error, successMessage);
        const value = formatValue
          ? formatValue(field.state.value, field)
          : coerceFieldValueToString(field.state.value);

        return (
          <Input
            {...props}
            value={value}
            error={error}
            success={success}
            onBlur={(event) => {
              field.handleBlur();
              onBlur?.(event);
            }}
            onChangeText={(text) => {
              const nextValue = parseValue ? parseValue(text, field) : text;
              field.handleChange(nextValue);
              onValueChange?.(nextValue, field);
            }}
          />
        );
      }}
    </form.Field>
  );
}

export function FormPassword({
  form,
  name,
  validators,
  asyncDebounceMs,
  defaultValue,
  parseValue,
  formatValue,
  hideErrorsUntilTouched = true,
  successMessage,
  onValueChange,
  onBlur,
  ...props
}: FormPasswordProps) {
  return (
    <form.Field
      name={name}
      validators={validators}
      asyncDebounceMs={asyncDebounceMs}
      defaultValue={defaultValue}
    >
      {(field: AnyField) => {
        const error = getFieldError(field, hideErrorsUntilTouched);
        const success = getFieldSuccess(field, error, successMessage);
        const value = formatValue
          ? formatValue(field.state.value, field)
          : coerceFieldValueToString(field.state.value);

        return (
          <PasswordInput
            {...props}
            value={value}
            error={error}
            success={success}
            onBlur={(event) => {
              field.handleBlur();
              onBlur?.(event);
            }}
            onChangeText={(text) => {
              const nextValue = parseValue ? parseValue(text, field) : text;
              field.handleChange(nextValue);
              onValueChange?.(nextValue, field);
            }}
          />
        );
      }}
    </form.Field>
  );
}

export function FormTextArea({
  form,
  name,
  validators,
  asyncDebounceMs,
  defaultValue,
  parseValue,
  formatValue,
  hideErrorsUntilTouched = true,
  successMessage,
  onValueChange,
  onBlur,
  ...props
}: FormTextAreaProps) {
  return (
    <form.Field
      name={name}
      validators={validators}
      asyncDebounceMs={asyncDebounceMs}
      defaultValue={defaultValue}
    >
      {(field: AnyField) => {
        const error = getFieldError(field, hideErrorsUntilTouched);
        const success = getFieldSuccess(field, error, successMessage);
        const value = formatValue
          ? formatValue(field.state.value, field)
          : coerceFieldValueToString(field.state.value);

        return (
          <TextArea
            {...props}
            value={value}
            error={error}
            success={success}
            onBlur={(event) => {
              field.handleBlur();
              onBlur?.(event);
            }}
            onChangeText={(text) => {
              const nextValue = parseValue ? parseValue(text, field) : text;
              field.handleChange(nextValue);
              onValueChange?.(nextValue, field);
            }}
          />
        );
      }}
    </form.Field>
  );
}

export function FormCheckbox({
  form,
  name,
  validators,
  asyncDebounceMs,
  defaultValue,
  hideErrorsUntilTouched = true,
  onValueChange,
  ...props
}: FormCheckboxProps) {
  return (
    <form.Field
      name={name}
      validators={validators}
      asyncDebounceMs={asyncDebounceMs}
      defaultValue={defaultValue}
    >
      {(field: AnyField) => {
        const error = getFieldError(field, hideErrorsUntilTouched);

        return (
          <Checkbox
            {...props}
            checked={Boolean(field.state.value)}
            error={error}
            onChange={(checked) => {
              field.handleChange(checked);
              field.handleBlur();
              onValueChange?.(checked, field);
            }}
          />
        );
      }}
    </form.Field>
  );
}
