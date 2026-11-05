import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { XIcon } from "./Icons";
import { cx } from "./styles";

const SIZES = { sm: "sm:max-w-md", md: "sm:max-w-lg", lg: "sm:max-w-2xl" };

// A native <dialog> opened as a modal: it traps focus, closes on Escape, and sits
// above everything. Render it only while open: {open && <Modal onClose={...} />}.
// On phones it is a bottom sheet; from the sm breakpoint up it is centered.
export function Modal({ title, description, onClose, children, size = "md" }) {
  const ref = useRef(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog.open) dialog.showModal();
    return () => dialog.close();
  }, []);

  return createPortal(
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      // A click on the dialog element itself (not its content) is a click on the backdrop.
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className={cx(
        "mx-0 mb-0 mt-auto max-h-[92dvh] w-full max-w-none rounded-t-2xl border border-border bg-surface p-0 text-fg shadow-pop",
        "backdrop:bg-black/55 backdrop:backdrop-blur-[2px]",
        "sm:m-auto sm:max-h-[calc(100dvh-4rem)] sm:w-[calc(100%-2rem)] sm:rounded-2xl",
        SIZES[size],
      )}
    >
      <div className="flex max-h-[inherit] flex-col">
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-semibold">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 -mt-1 rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-fg"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">{children}</div>
      </div>
    </dialog>,
    document.body,
  );
}
