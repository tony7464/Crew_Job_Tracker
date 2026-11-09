import { useImperativeHandle, useRef, useState } from "react";
import { api, apiUpload, apiUrl } from "../api";
import { useAsync } from "../hooks";
import ConfirmButton from "./ConfirmButton";
import ErrorMessage from "./ErrorMessage";
import { FormActions, Input } from "./Field";
import Loading from "./Loading";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { Modal } from "./ui/Modal";

// The client's signature on a job. The crew hands the phone over; the client signs
// with a finger and types their name. Signing again replaces it; the owner can delete it.
export default function SignatureCard({ jobId, onSigned }) {
  const [reload, setReload] = useState(0);
  const { data, error } = useAsync(api, `/api/jobs/${jobId}/signature`, reload);
  const [signing, setSigning] = useState(false);

  if (error) {
    return (
      <Card title="Client signature">
        <ErrorMessage error={error} />
      </Card>
    );
  }
  if (!data) {
    return (
      <Card title="Client signature">
        <Loading label="Loading…" />
      </Card>
    );
  }
  if (!data.enabled && !data.signature) return null;

  const signature = data.signature;
  return (
    <Card title="Client signature" description={signature ? null : "Have the client sign when the work is done."}>
      {signature ? (
        <div className="space-y-3">
          <div className="rounded-lg border border-border bg-white p-2">
            <img
              src={apiUrl(signature.url)}
              alt={`Signature of ${signature.signer_name}`}
              width={signature.width}
              height={signature.height}
              className="mx-auto h-auto max-h-32 w-auto max-w-full"
            />
          </div>
          <p className="text-sm">
            <span className="font-medium">{signature.signer_name}</span>
            <span className="text-muted">
              {" "}
              · {new Date(signature.signed_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} ·
              taken by {signature.captured_by.name}
            </span>
          </p>
          <div className="flex flex-wrap items-center gap-3">
            {data.can_sign && data.enabled && (
              <Button variant="secondary" size="sm" onClick={() => setSigning(true)}>
                Sign again
              </Button>
            )}
            {data.can_delete && (
              <ConfirmButton
                label="Delete signature"
                confirmLabel="Delete signature"
                busyLabel="Deleting…"
                onConfirm={async () => {
                  await api(`/api/jobs/${jobId}/signature`, { method: "DELETE" });
                  setReload((key) => key + 1);
                }}
              />
            )}
          </div>
        </div>
      ) : data.can_sign ? (
        <Button block onClick={() => setSigning(true)}>
          Get client signature
        </Button>
      ) : (
        <p className="text-sm text-muted">This job was cancelled.</p>
      )}
      {signing && (
        <SignatureModal
          jobId={jobId}
          onClose={() => setSigning(false)}
          onSaved={() => {
            setReload((key) => key + 1);
            onSigned?.();
          }}
        />
      )}
    </Card>
  );
}

// Strokes in canvas pixels, drawn at the screen's pixel density so lines stay sharp.
// ref gets { clear(), toBlob() }.
function SignaturePad({ ref, onChange }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);

  // Sized on the first stroke, not on mount: the dialog it sits in opens after this
  // component mounts, and until then the canvas has no size. Resizing clears it.
  function context() {
    const canvas = canvasRef.current;
    const ratio = window.devicePixelRatio || 1;
    const { width, height } = canvas.getBoundingClientRect();
    const wanted = [Math.round(width * ratio), Math.round(height * ratio)];
    const ctx = canvas.getContext("2d");
    if (canvas.width !== wanted[0] || canvas.height !== wanted[1]) {
      [canvas.width, canvas.height] = wanted;
      ctx.scale(ratio, ratio);
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#111827";
    }
    return ctx;
  }

  function point(event) {
    const rect = canvasRef.current.getBoundingClientRect();
    return [event.clientX - rect.left, event.clientY - rect.top];
  }

  function down(event) {
    event.preventDefault();
    canvasRef.current.setPointerCapture(event.pointerId);
    drawing.current = true;
    const ctx = context();
    const [x, y] = point(event);
    ctx.beginPath();
    ctx.moveTo(x, y);
    // A tap leaves a dot.
    ctx.lineTo(x + 0.1, y + 0.1);
    ctx.stroke();
    onChange(true);
  }

  function move(event) {
    if (!drawing.current) return;
    const ctx = context();
    const [x, y] = point(event);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function up() {
    drawing.current = false;
  }

  useImperativeHandle(ref, () => ({
    clear() {
      const canvas = canvasRef.current;
      canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
      onChange(false);
    },
    toBlob: () => new Promise((resolve) => canvasRef.current.toBlob(resolve, "image/png")),
  }));

  return (
    <canvas
      ref={canvasRef}
      aria-label="Sign here with your finger or mouse"
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      className="h-48 w-full touch-none rounded-lg border-2 border-dashed border-border-strong bg-white"
    />
  );
}

function SignatureModal({ jobId, onClose, onSaved }) {
  const [name, setName] = useState("");
  const [drawn, setDrawn] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const pad = useRef(null);

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const blob = await pad.current.toBlob();
      const form = new FormData();
      form.append("signature", blob, "signature.png");
      form.append("signer_name", name.trim());
      await apiUpload(`/api/jobs/${jobId}/signature`, form);
      onSaved();
      onClose();
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Client signature" description="Sign in the box to confirm the work is done." onClose={onClose}>
      <form onSubmit={save} className="space-y-4">
        <SignaturePad ref={pad} onChange={setDrawn} />
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={() => pad.current.clear()} disabled={!drawn}>
            Clear
          </Button>
        </div>
        <Input label="Name" value={name} onChange={(event) => setName(event.target.value)} maxLength={120} required autoComplete="name" />
        <ErrorMessage error={error} />
        <FormActions>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={!drawn || !name.trim() || saving}>
            {saving ? "Saving…" : "Save signature"}
          </Button>
        </FormActions>
      </form>
    </Modal>
  );
}
