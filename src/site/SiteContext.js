import { createContext, useContext } from "react";

// What every block of a business's website can read:
// - site: { slug, name, settings (with defaults filled in), pages, request_url, services,
//   images: { <photo id>: { width, height } } for the site's own photos }
// - editing: true inside the editor, where links and buttons do not go anywhere.
export const SiteContext = createContext(null);

export function useSite() {
  return useContext(SiteContext);
}

// What the editor's photo boxes read (the editor only; see PhotoLibrary.jsx):
// { images: [{ id, width, height, used_on, from_job }], choose({ several }) -> Promise<[id] | null> }
export const PhotosContext = createContext(null);

export function usePhotos() {
  return useContext(PhotosContext);
}
