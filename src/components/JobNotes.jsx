import { api } from "../api";
import { useAsync, useSubmit } from "../hooks";
import ErrorMessage from "./ErrorMessage";
import { TextArea } from "./Field";
import Loading from "./Loading";
import { Avatar } from "./ui/Avatar";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";

const MAX_NOTE = 2000;

function formatStamp(value) {
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// The timestamped notes log on a job, shared by the owner and assigned employees.
export default function JobNotes({ jobId }) {
  const { data: notes, setData, error } = useAsync(api, `/api/jobs/${jobId}/notes`);
  const submit = useSubmit(async (body) => {
    const note = await api(`/api/jobs/${jobId}/notes`, { method: "POST", body });
    setData((current) => [...(current || []), note]);
  }, true);

  function onSubmitForm(event) {
    const form = new FormData(event.target);
    submit.handleSubmit(event, { body: form.get("body") });
  }

  return (
    <Card title="Notes log" description="Updates from the crew and the owner. Notes cannot be edited.">
      {error ? (
        <ErrorMessage error={error} />
      ) : !notes ? (
        <Loading label="Loading notes…" />
      ) : notes.length === 0 ? (
        <p className="rounded-lg bg-surface-2 px-3 py-4 text-center text-sm text-muted">No notes yet.</p>
      ) : (
        <ol className="space-y-4">
          {notes.map((note) => (
            <li key={note.id} className="flex gap-3">
              <Avatar person={note.author} size="md" />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted">
                  <span className="font-semibold text-fg">{note.author.username}</span>{" "}
                  <time dateTime={note.created_at}>{formatStamp(note.created_at)}</time>
                </p>
                <p className="mt-1 whitespace-pre-wrap break-words rounded-lg rounded-tl-sm bg-surface-2 px-3 py-2 text-sm">
                  {note.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
      <form onSubmit={onSubmitForm} className="mt-5 space-y-3 border-t border-border pt-4">
        <TextArea label="Add a note" name="body" rows="3" maxLength={MAX_NOTE} required />
        <ErrorMessage error={submit.error} />
        <div className="flex justify-end">
          <Button type="submit" disabled={submit.submitting} className="w-full sm:w-auto">
            {submit.submitting ? "Adding…" : "Add note"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
