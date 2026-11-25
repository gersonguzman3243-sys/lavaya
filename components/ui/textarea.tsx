import * as React from "react";
import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "min-h-24 w-full rounded-2xl border border-border bg-white px-4 py-3 text-base text-ink outline-none placeholder:text-muted-foreground focus:border-leaf focus:ring-2 focus:ring-leaf/30",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
