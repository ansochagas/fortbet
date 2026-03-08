import React from "react";
import { getStatusMeta } from "../domain";

export const StatusBadge = ({ status }) => {
  const meta = getStatusMeta(status);
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${meta.badgeClass}`}
    >
      {meta.label}
    </span>
  );
};
