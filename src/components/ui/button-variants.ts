import { cva } from "class-variance-authority";

export const buttonVariants = cva(
  "clause-button inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium outline-none transition-[background-color,color,border-color,transform,opacity] duration-150 ease-[var(--ease-out)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-45 active:scale-[0.97]",
  {
    variants: {
      variant: {
        primary:
          "bg-[var(--foreground)] text-[var(--background)] hover:bg-[var(--foreground-strong)]",
        secondary:
          "border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-hover)]",
        ghost:
          "text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--foreground)]",
        danger:
          "bg-[var(--danger)] text-white hover:bg-[var(--danger-strong)]",
      },
      size: {
        sm: "h-8 px-3",
        md: "h-10 px-4",
        lg: "h-11 px-5",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);
