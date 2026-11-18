import { Component } from "react";

// A safety net around one block of a business's website. If a block cannot be drawn (its
// data is not what the block expects), only that block is left out: the rest of the page,
// and the editor, carry on. Without it one bad block would blank the whole page.
export default class BlockBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    // Visitors see the page without the block; the owner is told which one to replace.
    if (!this.props.editing) return null;
    return (
      <p className="m-4 rounded-xl border border-dashed p-4 text-sm" style={{ borderColor: "var(--site-border)", color: "var(--site-muted)" }}>
        This block could not be drawn, so it is left out of your site. Delete it and add it again.
      </p>
    );
  }
}
