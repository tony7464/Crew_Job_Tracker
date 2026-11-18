import { useMemo, useState } from "react";
import { api } from "../api";
import ErrorMessage from "../components/ErrorMessage";
import { FormActions, Input, Select, TextArea } from "../components/Field";
import Loading from "../components/Loading";
import { Badge } from "../components/ui/Badge";
import { Button, ButtonLink } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/Feedback";
import { DollarIcon, PencilIcon, PlusIcon, SearchIcon } from "../components/ui/Icons";
import { PageHeader } from "../components/ui/PageHeader";
import { cx } from "../components/ui/styles";
import { useAsync } from "../hooks";
import { formatMoney } from "../utils/format";
import { PRICE_BOOK_KINDS, filterPriceBook, kindLabel } from "../utils/priceBook";

const PATH = "/api/price_book?include_archived=true";

function fieldErrors(error) {
  const errors = error?.data?.errors || {};
  const first = (key) => (errors[key] ? [].concat(errors[key])[0] : undefined);
  return { first, other: error && !Object.keys(errors).length };
}

// What each kind is for, shown under the Type picker.
const KIND_HINTS = {
  service: "Work you sell, like a gutter clean per home.",
  material: "Something used up on a job. Crews can put it on a job's list, without seeing the price, and you can add what a job used to its invoice.",
  labor: "Time by the hour. On an invoice, Add clocked hours fills in the hours worked on the job.",
};

function ItemForm({ item, startKind = "service", categories, onSave, onCancel }) {
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [kind, setKind] = useState(item?.kind || startKind);
  const [unit, setUnit] = useState(item ? item.unit || "" : startKind === "labor" ? "hour" : "");
  const { first, other } = fieldErrors(error);

  function changeKind(next) {
    setKind(next);
    // Labor is by the hour unless the owner already typed something else.
    if (next === "labor" && !unit.trim()) setUnit("hour");
  }

  async function submit(event) {
    event.preventDefault();
    const form = new FormData(event.target);
    setSaving(true);
    setError(null);
    try {
      await onSave({
        name: form.get("name"),
        kind,
        unit_price: form.get("unit_price"),
        unit,
        category: form.get("category"),
        description: form.get("description"),
      });
    } catch (err) {
      setError(err);
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[11rem_1fr]">
        <Select label="Type" value={kind} onChange={(event) => changeKind(event.target.value)} error={first("kind")}>
          {PRICE_BOOK_KINDS.map(([value, label]) => (
            <option key={value} value={value}>
              {value === "labor" ? "Labor (hourly)" : label}
            </option>
          ))}
        </Select>
        <Input label="Name" name="name" defaultValue={item?.name} maxLength={120} required error={first("name")} />
      </div>
      <p className="-mt-1 text-xs text-muted">{KIND_HINTS[kind]}</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Input
          label="Price"
          name="unit_price"
          defaultValue={item?.unit_price}
          inputMode="decimal"
          placeholder="0.00"
          required
          error={first("unit_price")}
        />
        <Input
          label="Per"
          name="unit"
          value={unit}
          onChange={(event) => setUnit(event.target.value)}
          maxLength={20}
          placeholder={kind === "material" ? "each, box, gal" : kind === "labor" ? "hour" : "window, home"}
          error={first("unit")}
        />
        <div className="col-span-2">
          <Input
            label="Category"
            name="category"
            defaultValue={item?.category || ""}
            maxLength={60}
            list="price-book-categories"
            placeholder="Windows, Gutters"
            error={first("category")}
          />
          <datalist id="price-book-categories">
            {categories.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </div>
      </div>
      <TextArea
        label="Detail on the line (optional)"
        name="description"
        defaultValue={item?.description || ""}
        maxLength={2000}
        rows={3}
        hint="Added with the name on quotes and invoices. A long one, such as what is included and what is not, goes under the name."
        error={first("description")}
      />
      {other && <ErrorMessage error={error} />}
      <FormActions>
        {onCancel && (
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : item ? "Save" : "Add to price book"}
        </Button>
      </FormActions>
    </form>
  );
}

// showKind: label the row with its type (when the list mixes types).
function ItemRow({ item, categories, showKind, onChanged }) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function patch(body) {
    const next = await api(`/api/price_book/${item.id}`, { method: "PATCH", body });
    onChanged(next);
  }

  async function run(action) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <li className="py-4">
        <ItemForm
          item={item}
          categories={categories}
          onCancel={() => setEditing(false)}
          onSave={async (body) => {
            await patch(body);
            setEditing(false);
          }}
        />
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 font-medium">
          <span className="[overflow-wrap:anywhere]">{item.name}</span>
          {showKind && <Badge tone={item.kind === "service" ? "neutral" : "primary"}>{kindLabel(item.kind)}</Badge>}
          {item.archived && <Badge>Hidden</Badge>}
        </p>
        {item.description && <p className="line-clamp-2 text-sm text-muted [overflow-wrap:anywhere]">{item.description}</p>}
      </div>
      <p className="shrink-0 text-sm font-medium tabular-nums">
        {formatMoney(item.unit_price_cents)}
        {item.unit && <span className="font-normal text-muted"> / {item.unit}</span>}
      </p>
      <div className="flex shrink-0 gap-1">
        <Button variant="ghost" size="sm" onClick={() => setEditing(true)} disabled={busy} aria-label={`Edit ${item.name}`}>
          <PencilIcon className="h-4 w-4" />
          Edit
        </Button>
        <Button variant="ghost" size="sm" disabled={busy} onClick={() => run(() => patch({ archived: !item.archived }))}>
          {item.archived ? "Show" : "Hide"}
        </Button>
      </div>
      {error && <div className="w-full"><ErrorMessage error={error} /></div>}
    </li>
  );
}

export default function PriceBookPage() {
  const { data: items, setData, error } = useAsync(api, PATH);
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");

  const categories = useMemo(
    () => [...new Set((items || []).map((item) => item.category).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [items],
  );
  const groups = useMemo(() => {
    const byCategory = new Map();
    for (const item of filterPriceBook(items, { query, kind })) {
      const key = item.category || "Other";
      byCategory.set(key, [...(byCategory.get(key) || []), item]);
    }
    return [...byCategory.entries()];
  }, [items, query, kind]);
  const counts = useMemo(() => {
    const found = { all: (items || []).length };
    for (const item of items || []) found[item.kind] = (found[item.kind] || 0) + 1;
    return found;
  }, [items]);
  const newKind = kind === "all" ? "service" : kind;

  const replace = (next) => setData((current) => current.map((item) => (item.id === next.id ? next : item)));

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Price book"
        description="Your services, materials, and hourly rates with their usual prices. Add them to quotes and invoices with From price book, and change the price on any line."
        actions={
          !adding && (
            <>
              <ButtonLink to="/import" variant="secondary">
                Import or export
              </ButtonLink>
              <Button onClick={() => setAdding(true)}>
                <PlusIcon />
                Add item
              </Button>
            </>
          )
        }
      />
      {error && <ErrorMessage error={error} />}
      {!items && !error && <Loading variant="list" label="Loading the price book…" />}
      {items && (
        <div className="space-y-4">
          {adding && (
            <Card title="New item">
              <ItemForm
                startKind={newKind}
                categories={categories}
                onCancel={() => setAdding(false)}
                onSave={async (body) => {
                  const item = await api("/api/price_book", { method: "POST", body });
                  setData((current) => [...current, item]);
                  setAdding(false);
                }}
              />
            </Card>
          )}
          {items.length === 0 && !adding ? (
            <EmptyState
              icon={DollarIcon}
              title="Nothing in the price book yet"
              description="Add what you charge for: services like a gutter clean per home, materials like sealant per tube, and labor by the hour. Crew who quote on site can use it too."
              action={
                <Button onClick={() => setAdding(true)}>
                  <PlusIcon />
                  Add your first item
                </Button>
              }
            />
          ) : (
            items.length > 0 && (
              <>
                <label className="relative block">
                  <span className="sr-only">Search the price book</span>
                  <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search the price book"
                    className="field pl-9"
                  />
                </label>
                <div role="group" aria-label="Show" className="flex flex-wrap gap-2">
                  {[["all", "All", "All"], ...PRICE_BOOK_KINDS].map(([value, , label]) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={kind === value}
                      onClick={() => setKind(value)}
                      className={cx(
                        "rounded-full border px-3 py-1.5 text-sm font-medium",
                        kind === value ? "border-primary bg-primary text-primary-fg" : "border-border text-muted hover:text-fg",
                      )}
                    >
                      {label} <span className="tabular-nums opacity-75">{counts[value] || 0}</span>
                    </button>
                  ))}
                </div>
                {groups.length === 0 && (
                  <p className="text-sm text-muted">
                    {query.trim() || kind === "all" ? "Nothing matches." : `No ${kindLabel(kind).toLowerCase()} items yet. Use Add item to make one.`}
                  </p>
                )}
                {groups.map(([category, rows]) => (
                  <Card key={category} title={category}>
                    <ul className="-my-3 divide-y divide-border">
                      {rows.map((item) => (
                        <ItemRow key={item.id} item={item} categories={categories} showKind={kind === "all"} onChanged={replace} />
                      ))}
                    </ul>
                  </Card>
                ))}
              </>
            )
          )}
        </div>
      )}
    </div>
  );
}
