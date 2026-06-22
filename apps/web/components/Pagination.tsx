"use client";

import { useEffect, useState } from "react";
import { Button } from "./ui";

/** Client-side pagination for an already-loaded list. Resets when the list shrinks. */
export function usePagination<T>(items: T[], pageSize = 10) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [page, totalPages]);
  const pageItems = items.slice((page - 1) * pageSize, page * pageSize);
  return { page, setPage, totalPages, total: items.length, pageItems };
}

export function Pagination({
  page,
  totalPages,
  total,
  onPage,
  label = "items",
}: {
  page: number;
  totalPages: number;
  total: number;
  onPage: (p: number) => void;
  label?: string;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="mt-5 flex items-center justify-between text-sm text-[var(--muted)]">
      <span>
        {total} {label}
      </span>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Prev
        </Button>
        <span className="tabular-nums">
          {page} / {totalPages}
        </span>
        <Button
          variant="ghost"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
