import { useEffect, useState } from "react";
import { api } from "./api";

// `load` must be a stable function (api or fetchAll), not an inline arrow.
export function useAsync(load, path) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    load(path)
      .then((value) => {
        if (!cancelled) setData(value);
      })
      .catch((err) => {
        if (!cancelled) setError(err);
      });
    return () => {
      cancelled = true;
    };
  }, [load, path]);

  return { data, setData, error };
}

export function usePaged(path, query = "") {
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const params = new URLSearchParams(query);
    params.set("page", String(page));
    let cancelled = false;
    api(`${path}?${params}`)
      .then((data) => {
        if (cancelled) return;
        // The last row on this page was deleted, so step back.
        if (data.items.length === 0 && page > 1) {
          setPage(page - 1);
          return;
        }
        setResult(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err);
      });
    return () => {
      cancelled = true;
    };
  }, [path, query, page, reloadKey]);

  function reload() {
    setReloadKey((key) => key + 1);
  }

  function reset() {
    if (page !== 1) setPage(1);
    else reload();
  }

  return { page, setPage, result, setResult, error, reload, reset };
}

export function useSubmit(onSubmit, resetOnSuccess) {
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event, body) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(body);
      if (resetOnSuccess) event.target.reset();
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
    }
  }

  return { error, submitting, handleSubmit };
}
