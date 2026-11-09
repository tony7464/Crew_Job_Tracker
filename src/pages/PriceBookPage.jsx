import { useMemo, useState } from "react";
import { api } from "../api";
import ErrorMessage from "../components/ErrorMessage";
import { FormActions, Input } from "../components/Field";
import Loading from "../components/Loading";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { EmptyState } from "../components/ui/Feedback";
import { DollarIcon, PencilIcon, PlusIcon, SearchIcon } from "../components/ui/Icons";
import { PageHeader } from "../components/ui/PageHeader";
import { useAsync } from "../hooks";
import { formatMoney } from "../utils/format";

const PATH = "/api/price_book?include_archived=true";

function fieldErrors(error) {
  const errors = error?.data?.errors || {};
  const first = (key) => (errors[key] ? [].concat(errors[key])[0] : undefined);
  return { first, other: error && !Object.keys(errors).length };
}

function ItemForm({ item, categories, onSave, onCancel }) {
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const { first, other } = fieldErrors(error);

  async function submit(event) {
    event.preventDefault();
    const form = new FormData(event.target);
    setSaving(true);
    setError(null);
    try {
      await onSave({
        name: form.get("name"),
        unit_price: form.get("unit_price"),
        unit: form.get("unit"),
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
      <Input label="Service" name="name" defaultValue={item?.name} maxLength={120} required error={first("name")} />
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
        <Input label="Per" name="unit" defaultValue={item?.unit || ""} maxLength={20} placeholder="window, hour" error={first("unit")} />
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
      <Input
        label="Detail on the line (optional)"
        name="description"
        defaultValue={item?.description || ""}
        maxLength={200}
        hint="Added after the name on quotes and invoices."
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

function ItemRow({ item, categories, onChanged }) {
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
          {item.archived && <Badge>Hidden</Badge>}
        </p>
        {item.description && <p className="text-sm text-muted [overflow-wrap:anywhere]">{item.description}</p>}
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

  const categories = useMemo(
    () => [...new Set((items || []).map((item) => item.category).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [items],
  );
  const groups = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const matching = (items || []).filter((item) => {
      const text = [item.name, item.description, item.category, item.unit].filter(Boolean).join(" ").toLowerCase();
      return words.every((word) => text.includes(word));
    });
    const byCategory = new Map();
    for (const item of matching) {
      const key = item.category || "Other";
      byCategory.set(key, [...(byCategory.get(key) || []), item]);
    }
    return [...byCategory.entries()];
  }, [items, query]);

  const replace = (next) => setData((current) => current.map((item) => (item.id === next.id ? next : item)));

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Price book"
        description="Your services and usual prices. Add them to quotes and invoices with From price book, and change the price on any line."
        actions={
          !adding && (
            <Button onClick={() => setAdding(true)}>
              <PlusIcon />
              Add service
            </Button>
          )
        }
      />
      {error && <ErrorMessage error={error} />}
      {!items && !error && <Loading variant="list" label="Loading the price book…" />}
      {items && (
        <div className="space-y-4">
          {adding && (
            <Card title="New service">
              <ItemForm
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
              title="No services yet"
              description="Add what you sell, like window cleaning per window or a gutter clean per home. Crew who quote on site can use it too."
              action={
                <Button onClick={() => setAdding(true)}>
                  <PlusIcon />
                  Add your first service
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
                    placeholder="Search services"
                    className="field pl-9"
                  />
                </label>
                {groups.length === 0 && <p className="text-sm text-muted">Nothing matches.</p>}
                {groups.map(([category, rows]) => (
                  <Card key={category} title={category}>
                    <ul className="-my-3 divide-y divide-border">
                      {rows.map((item) => (
                        <ItemRow key={item.id} item={item} categories={categories} onChanged={replace} />
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
