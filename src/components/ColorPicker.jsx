import { useState } from "react";
import { EMPLOYEE_PALETTE, FALLBACK_COLOR, isHexColor, readableText } from "../utils/color";
import { Button } from "./ui/Button";
import { CheckIcon } from "./ui/Icons";
import { cx } from "./ui/styles";

// Palette swatches plus a custom color. onChange(hex) is called with a lowercase "#rrggbb".
// Give it key={value} so the custom field resets after a save.
export default function ColorPicker({ value, onChange, disabled = false, label = "Calendar color" }) {
  const current = isHexColor(value) ? value.toLowerCase() : FALLBACK_COLOR;
  const [custom, setCustom] = useState(current);
  const inPalette = EMPLOYEE_PALETTE.some(([hex]) => hex === current);

  return (
    <fieldset disabled={disabled} className="disabled:opacity-60">
      <legend className="mb-2 text-sm font-medium text-fg">{label}</legend>
      <div className="flex flex-wrap items-center gap-2">
        {EMPLOYEE_PALETTE.map(([hex, name]) => {
          const selected = hex === current;
          return (
            <button
              key={hex}
              type="button"
              title={name}
              aria-label={name}
              aria-pressed={selected}
              onClick={() => !selected && onChange(hex)}
              className={cx(
                "flex h-7 w-7 items-center justify-center rounded-full ring-offset-2 ring-offset-surface transition-transform hover:scale-110",
                selected && "ring-2 ring-fg",
              )}
              style={{ backgroundColor: hex }}
            >
              {selected && <CheckIcon className="h-4 w-4" style={{ color: readableText(hex) }} />}
            </button>
          );
        })}
        <label
          title="Custom color"
          className={cx(
            "inline-flex h-8 cursor-pointer items-center gap-2 rounded-full border border-border-strong bg-surface pl-1 pr-3 text-xs text-muted hover:bg-surface-2",
            !inPalette && "ring-2 ring-fg ring-offset-2 ring-offset-surface",
          )}
        >
          <input
            type="color"
            value={custom}
            onChange={(event) => setCustom(event.target.value.toLowerCase())}
            aria-label="Custom color"
            className="h-6 w-6 cursor-pointer appearance-none rounded-full border-0 bg-transparent p-0 [&::-moz-color-swatch]:rounded-full [&::-moz-color-swatch]:border-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0"
          />
          <span className="font-mono">{custom}</span>
        </label>
        {custom !== current && (
          <Button size="sm" variant="soft" onClick={() => onChange(custom)}>
            Use this color
          </Button>
        )}
      </div>
    </fieldset>
  );
}
