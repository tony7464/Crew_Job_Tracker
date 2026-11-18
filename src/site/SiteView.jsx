import { useMemo } from "react";
import BlockBoundary from "./BlockBoundary";
import * as blocks from "./blocks";
import { SiteContext } from "./SiteContext";
import SiteFrame from "./SiteFrame";
import { withDefaults } from "./siteUtils";

// Blocks that hold other blocks, and the settings they hold them in.
const SLOTS = { Columns: ["first", "second", "third"] };
// Every block a site may have, by its name in the data. A name that is not here is skipped.
const BLOCKS = {
  Hero: blocks.Hero,
  Heading: blocks.Heading,
  Text: blocks.Text,
  Button: blocks.Button,
  Services: blocks.Services,
  Features: blocks.Features,
  Reviews: blocks.Reviews,
  Faq: blocks.Faq,
  Contact: blocks.Contact,
  RequestQuote: blocks.RequestQuote,
  Columns: blocks.Columns,
  Spacer: blocks.Spacer,
  Divider: blocks.Divider,
  Image: blocks.Image,
  Gallery: blocks.Gallery,
  PhotoText: blocks.PhotoText,
};

// A list of blocks from a page's data, drawn in order.
function Blocks({ list }) {
  return (Array.isArray(list) ? list : []).map((block, index) => {
    // Only a name of its own: "constructor" is on every object and is not a block.
    const Block = block && Object.hasOwn(BLOCKS, block.type) ? BLOCKS[block.type] : null;
    if (!Block) return null;
    const { id, ...props } = block.props || {};
    for (const slot of SLOTS[block.type] || []) props[slot] = <Blocks list={props[slot]} />;
    return (
      <BlockBoundary key={typeof id === "string" ? id : index}>
        <Block {...props} />
      </BlockBoundary>
    );
  });
}

// One page of a business's website as visitors see it, drawn from the data the API gives
// (GET /api/public/sites/<slug>). It does not load the editor.
export default function SiteView({ site, page }) {
  const value = useMemo(
    () => ({ site: { ...site, settings: withDefaults(site.settings, site.name) }, editing: false }),
    [site],
  );
  return (
    <SiteContext.Provider value={value}>
      <SiteFrame current={page.slug}>
        <Blocks list={page.data?.content} />
      </SiteFrame>
    </SiteContext.Provider>
  );
}
