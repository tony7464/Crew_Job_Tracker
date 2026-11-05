import { cx } from "./styles";

const ALIGN = { left: "text-left", right: "text-right", center: "text-center" };

// A table from the md breakpoint up, and a stack of cards on phones.
// columns: [{ key, header, cell(row), align, className, mobile }]
//   mobile: false hides a column on phones; the first column is each card's title.
// renderMobile(row): optional custom card body for phones.
export function DataTable({ columns, rows, rowKey = (row) => row.id, renderMobile, caption }) {
  const [first, ...rest] = columns;
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-card">
      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full text-sm">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead className="bg-surface-2">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={cx(
                    "px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted",
                    ALIGN[column.align || "left"],
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={rowKey(row)} className="align-middle transition-colors hover:bg-surface-2/60">
                {columns.map((column) => (
                  <td key={column.key} className={cx("px-4 py-3", ALIGN[column.align || "left"], column.className)}>
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="divide-y divide-border md:hidden">
        {rows.map((row) => (
          <li key={rowKey(row)} className="px-4 py-3.5">
            {renderMobile ? (
              renderMobile(row)
            ) : (
              <>
                <div className="font-medium">{first.cell(row)}</div>
                <dl className="mt-1.5 space-y-1 text-sm">
                  {rest
                    .filter((column) => column.mobile !== false)
                    .map((column) => (
                      <div key={column.key} className="flex gap-2">
                        <dt className="w-20 shrink-0 text-muted">{column.header}</dt>
                        <dd className="min-w-0 flex-1">{column.cell(row)}</dd>
                      </div>
                    ))}
                </dl>
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
