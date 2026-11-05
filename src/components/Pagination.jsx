import { Button } from "./ui/Button";
import { ChevronLeftIcon, ChevronRightIcon } from "./ui/Icons";

export default function Pagination({ page, pages, onPage }) {
  if (pages <= 1) return null;

  return (
    <nav aria-label="Pages" className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted">
        Page <span className="font-medium text-fg">{page}</span> of {pages}
      </span>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" onClick={() => onPage(page - 1)} disabled={page <= 1}>
          <ChevronLeftIcon />
          Prev
        </Button>
        <Button variant="secondary" size="sm" onClick={() => onPage(page + 1)} disabled={page >= pages}>
          Next
          <ChevronRightIcon />
        </Button>
      </div>
    </nav>
  );
}
