import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import Loading from "../components/Loading";

const PublicSitePage = lazy(() => import("../pages/PublicSitePage"));

// A business's website on its own web address: the home page at /, the others at /<page>.
// Any other address there is a page the site does not have.
export default function HostSite({ site }) {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/" element={<PublicSitePage host={site} />} />
        <Route path="/:page" element={<PublicSitePage host={site} />} />
        <Route path="*" element={<PublicSitePage host={site} missing />} />
      </Routes>
    </Suspense>
  );
}
