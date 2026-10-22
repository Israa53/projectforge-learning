import { forwardRef, type ComponentPropsWithoutRef } from "react";

type ButtonProps = ComponentPropsWithoutRef<"button"> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "default" | "small" | "icon";
  isLoading?: boolean;
  loadingText?: string;
};

// Forward the DOM ref so callers can restore focus after a confirmation closes.
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "primary",
      size = "default",
      type = "button",
      isLoading = false,
      loadingText,
      disabled,
      className = "",
      children,
      ...props
    },
    ref,
  ) {
    return (
      <button
        {...props}
        ref={ref}
        type={type}
        className={`button button--${variant} button--${size} ${className}`.trim()}
        disabled={disabled || isLoading}
        aria-busy={isLoading || undefined}
      >
        {isLoading && <span className="button-spinner" aria-hidden="true" />}
        {isLoading ? (loadingText ?? children) : children}
      </button>
    );
  },
);
