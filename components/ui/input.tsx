import * as React from "react";
import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      className={cn(
        "h-12 w-full rounded-2xl border border-border bg-white px-4 text-base text-ink outline-none placeholder:text-muted-foreground focus:border-leaf focus:ring-2 focus:ring-leaf/30",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
