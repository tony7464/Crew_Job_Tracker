export default function Pagination({ page, pages, onPage }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <button
        type="button"
        onClick={() => onPage(page - 1)}
        disabled={page <= 1}
        className="rounded border border-slate-300 bg-white px-3 py-1 disabled:opacity-40"
      >
        Prev
      </button>
      <span>
        Page {page} of {pages}
      </span>
      <button
        type="button"
        onClick={() => onPage(page + 1)}
        disabled={pages === 0 || page >= pages}
        className="rounded border border-slate-300 bg-white px-3 py-1 disabled:opacity-40"
      >
        Next
      </button>
    </div>
  );
}