import type { ReactNode } from "react";

type FormFieldProps = {
  htmlFor: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  className?: string;
  children: ReactNode;
};

// Controls keep their native props, event types, and refs.
// For hint/error text, the control should use the matching aria-describedby ID.
export function FormField({
  htmlFor,
  label,
  hint,
  error,
  className = "",
  children,
}: FormFieldProps) {
  return (
    <div className={`field ${className}`.trim()}>
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {hint && (
        <p className="field-hint" id={`${htmlFor}-help`}>
          {hint}
        </p>
      )}
      {error && (
        <p className="field-error" id={`${htmlFor}-error`} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
