import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@/lib/utils";

type ButtonLinkProps = ComponentPropsWithoutRef<typeof Link> & {
  variant?: "primary" | "secondary";
};

export function ButtonLink({
  className,
  variant = "primary",
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      className={cn(
        "inline-flex h-11 items-center justify-center rounded-md px-4 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-ember focus:ring-offset-2 focus:ring-offset-ink",
        variant === "primary"
          ? "bg-ember text-ink shadow-aura hover:bg-[#ff7a91]"
          : "border border-white/12 bg-white/8 text-white hover:bg-white/12",
        className
      )}
      {...props}
    />
  );
}
