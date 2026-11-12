import { Component } from "react";
import { isChunkLoadError, reloadForNewVersion } from "../utils/chunkReload";
import { Button } from "./ui/Button";
import { LogoMark } from "./ui/Logo";

// Catches an error thrown while drawing any page, so the visitor sees a message and a way
// out instead of a blank white page. A page file that is gone after a deploy reloads the
// tab by itself (see utils/chunkReload.js); if that did not help, the message stays.
export default class ErrorBoundary extends Component {
  state = { error: null, reloading: false };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    if (isChunkLoadError(error) && reloadForNewVersion()) {
      this.setState({ reloading: true });
      return;
    }
    console.error("The page could not be shown.", error, info?.componentStack);
  }

  render() {
    const { error, reloading } = this.state;
    if (!error) return this.props.children;
    const newVersion = isChunkLoadError(error);
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center px-6 text-center">
        <LogoMark className="h-14 w-14" />
        <h1 className="mt-5 font-display text-2xl font-bold tracking-tight">
          {newVersion ? "A new version is ready" : "Something went wrong"}
        </h1>
        <p className="mt-2 text-sm text-muted" role="alert">
          {reloading
            ? "Loading the new version…"
            : newVersion
              ? "Crew Job Tracker was updated while this page was open. Reload to get the new version."
              : "This page could not be shown. Your data is safe. Reload the page, and if it keeps happening, go back to the start."}
        </p>
        {!reloading && (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" onClick={() => window.location.reload()}>
              Reload
            </Button>
            <a href="/" className="link text-sm">
              Go to the start page
            </a>
          </div>
        )}
      </main>
    );
  }
}
