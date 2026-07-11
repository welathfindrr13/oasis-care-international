"use client";

import React from "react";
import { cn } from "../../lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      asChild = false,
      children,
      ...props
    },
    ref,
  ) => {
    const classes = cn(
      "inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-md border text-sm font-semibold",
      "transition-colors duration-150 focus-visible:outline-none focus-visible:ring-0",
      "disabled:pointer-events-none disabled:opacity-55",
      {
        "border-oasis-teal bg-oasis-teal text-white hover:border-oasis-teal-dark hover:bg-oasis-teal-dark":
          variant === "primary",
        "border-oasis-control-border bg-white text-oasis-ink hover:bg-base-gray-50":
          variant === "secondary",
        "border-oasis-control-border bg-transparent text-oasis-ink hover:border-oasis-teal hover:bg-oasis-teal-soft":
          variant === "outline",
        "border-transparent bg-transparent text-oasis-teal hover:bg-oasis-teal-soft":
          variant === "ghost",
        "border-oasis-danger bg-oasis-danger text-white hover:bg-red-800":
          variant === "danger",
        "px-3 py-2": size === "sm",
        "px-4 py-2.5": size === "md",
        "min-h-12 px-5 py-3 text-base": size === "lg",
      },
      className,
    );

    if (asChild && React.isValidElement(children)) {
      return React.cloneElement(children as React.ReactElement<any>, {
        ...props,
        className: cn(
          classes,
          (children as React.ReactElement<any>).props?.className,
        ),
        ref,
      });
    }

    return (
      <button className={classes} ref={ref} {...props}>
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";

export { Button };
