import React from "react";
import { cn } from "@/lib/utils";

export const StatusBadge = ({ status, className }) => {
  const map = {
    NEW: { label: "NEW", cls: "badge-new" },
    HOT: { label: "HOT", cls: "badge-hot" },
    HOT_NEW: { label: "HOT • NEW", cls: "badge-hot-new" },
    NORMAL: { label: "—", cls: "badge-normal" },
  };
  const it = map[status] || map.NORMAL;
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 font-mono text-[10px] font-bold tracking-widest uppercase rounded-sm",
        it.cls,
        className
      )}
    >
      {it.label}
    </span>
  );
};
