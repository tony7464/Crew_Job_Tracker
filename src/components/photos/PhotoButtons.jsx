import { useId } from "react";
import { CameraIcon, ImageIcon } from "../ui/Icons";
import { buttonClass, cx } from "../ui/styles";

// Two ways to add photos: open the camera (on a phone, the back camera), or pick
// from the photo library. onFiles(files) gets the chosen files.
export default function PhotoButtons({ onFiles, disabled = false, size = "md", cameraLabel = "Take photo" }) {
  const cameraId = useId();
  const libraryId = useId();

  function pick(event) {
    const files = [...event.target.files];
    // Clear the input so picking the same photo again still fires a change.
    event.target.value = "";
    if (files.length) onFiles(files);
  }

  const label = (variant) =>
    cx(
      buttonClass({ variant, size }),
      "cursor-pointer has-focus-visible:ring-4 has-focus-visible:ring-ring",
      disabled && "pointer-events-none opacity-55",
    );

  return (
    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
      <label htmlFor={cameraId} className={label("primary")}>
        <CameraIcon />
        {cameraLabel}
        <input
          id={cameraId}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={pick}
          disabled={disabled}
          className="sr-only"
        />
      </label>
      <label htmlFor={libraryId} className={label("secondary")}>
        <ImageIcon />
        Choose photos
        <input
          id={libraryId}
          type="file"
          accept="image/*"
          multiple
          onChange={pick}
          disabled={disabled}
          className="sr-only"
        />
      </label>
    </div>
  );
}
