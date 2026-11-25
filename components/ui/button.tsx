import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl font-semibold transition active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
  {
    variants: {
      variant: {
        default: "bg-leaf text-white shadow-sm hover:bg-[#0c7d60]",
        mango: "bg-mango text-ink shadow-sm hover:bg-[#ff8d38]",
        outline: "border border-border bg-white text-ink hover:bg-secondary",
        ghost: "text-ink hover:bg-secondary",
        danger: "border border-red-200 bg-white text-red-700 hover:bg-red-50",
      },
      size: {
        default: "h-11 px-4 text-sm",
        lg: "h-14 px-5 text-base",
        sm: "h-9 px-3 text-sm",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };
