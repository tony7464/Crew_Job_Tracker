import { Suspense, lazy } from "react";
import { Navigate, Route, Routes, useMatch } from "react-router-dom";
import NavBar from "./components/NavBar";
import ProtectedRoute from "./components/ProtectedRoute";
import QuickAddButton from "./components/QuickAddButton";
import ClockBanner from "./components/time/ClockBanner";
import VerifyEmailBanner from "./components/VerifyEmail";
import Loading from "./components/Loading";
import { useAuth } from "./context/useAuth";
import AccountPage from "./pages/AccountPage";
import CalendarPage from "./pages/CalendarPage";
import ClientDetail from "./pages/ClientDetail";
import ClientsPage from "./pages/ClientsPage";
import DashboardPage from "./pages/DashboardPage";
import EmployeesPage from "./pages/EmployeesPage";
import JobDetail from "./pages/JobDetail";
import JobsPage from "./pages/JobsPage";
import LoginPage from "./pages/LoginPage";
import MyJobDetail from "./pages/MyJobDetail";
import MyJobsPage from "./pages/MyJobsPage";
import NewVisitPage from "./pages/NewVisitPage";
import PublicQuotePage from "./pages/PublicQuotePage";
import PublicRequestPage from "./pages/PublicRequestPage";
import QuoteDetail from "./pages/QuoteDetail";
import QuotesPage from "./pages/QuotesPage";
import ReportsPage from "./pages/ReportsPage";
import RequestDetail from "./pages/RequestDetail";
import RequestsPage from "./pages/RequestsPage";
import SchedulePage from "./pages/SchedulePage";
import SettingsPage from "./pages/SettingsPage";
import ShoppingListPage from "./pages/ShoppingListPage";
import SignupPage from "./pages/SignupPage";
import TimesheetsPage from "./pages/TimesheetsPage";
import LandingPage from "./pages/landing/LandingPage";
import { wasSignedIn } from "./context/signedIn";
import { homePath } from "./utils/roles";

// Loaded on first use, so the main bundle stays small; a client opening a pay link
// also loads less.
const InvoiceDetail = lazy(() => import("./pages/InvoiceDetail"));
const InvoicesPage = lazy(() => import("./pages/InvoicesPage"));
const PriceBookPage = lazy(() => import("./pages/PriceBookPage"));
const MockCheckoutPage = lazy(() => import("./pages/MockCheckoutPage"));
const PublicInvoicePage = lazy(() => import("./pages/PublicInvoicePage"));
const AcceptInvitePage = lazy(() => import("./pages/AcceptInvitePage"));
const VerifyEmailPage = lazy(() => import("./pages/VerifyEmailPage"));
const LegalPage = lazy(() => import("./pages/landing/LegalPage"));

// [path, page, who may visit]. See canVisit in utils/roles.js.
const PRIVATE = [
  ["/dashboard", DashboardPage, "owner"],
  ["/schedule", SchedulePage, "team"],
  ["/jobs", JobsPage, "owner"],
  ["/jobs/:id", JobDetail, "owner"],
  ["/employees", EmployeesPage, "owner"],
  ["/timesheets", TimesheetsPage, "owner"],
  ["/clients", ClientsPage, "clients"],
  ["/clients/:id", ClientDetail, "clients"],
  ["/requests", RequestsPage, "requests"],
  ["/requests/:id", RequestDetail, "requests"],
  // "New quote": book an estimate visit. The owner and leads, who book visits for clients.
  ["/visits/new", NewVisitPage, "clients"],
  // Quotes are money, so owner-only. /quotes/new takes ?request_id= or ?client_id=.
  ["/quotes", QuotesPage, "owner"],
  ["/quotes/new", QuoteDetail, "owner"],
  ["/quotes/:id", QuoteDetail, "owner"],
  // Invoices are money too. They are made from a job or an accepted quote, on those pages.
  ["/invoices", InvoicesPage, "owner"],
  ["/invoices/:id", InvoiceDetail, "owner"],
  ["/price-book", PriceBookPage, "owner"],
  ["/reports", ReportsPage, "owner"],
  ["/settings", SettingsPage, "owner"],
  ["/my-jobs", MyJobsPage, "employee"],
  ["/my-jobs/:id", MyJobDetail, "employee"],
  ["/calendar", CalendarPage, "employee"],
  ["/my-hours", TimesheetsPage, "employee"],
  // Materials still to pick up, across the jobs each person can see.
  ["/shopping", ShoppingListPage, undefined],
  ["/account", AccountPage, undefined],
];

function Home() {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  return <Navigate to={homePath(user)} replace />;
}

// crewjobtrack.com: the landing page for visitors; people who are logged in go to their home page.
// Someone who was signed in on this device waits for the session check instead of seeing the
// landing page flash first; a new visitor sees it at once.
function LandingGate() {
  const { user, loading } = useAuth();
  if (user) return <Navigate to={homePath(user)} replace />;
  if (loading && wasSignedIn()) return <Loading />;
  return <LandingPage />;
}

export default function App() {
  // The public request form, quote page, and pay page are their own pages for clients: no menu, no login.
  // So are the links we email: verifying an email, and an employee invite.
  const publicForm = useMatch("/request/:token");
  const publicQuote = useMatch("/quote/:token");
  const publicPay = useMatch("/pay/:token/*");
  const publicInvite = useMatch("/invite/:token");
  const verifyEmail = useMatch("/verify-email");
  // The marketing pages have their own header and footer.
  const landing = useMatch("/");
  const pricing = useMatch("/pricing");
  const terms = useMatch("/terms");
  const privacy = useMatch("/privacy");
  if (landing || pricing || terms || privacy) {
    return (
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<LandingGate />} />
          <Route path="/pricing" element={<LandingPage section="pricing" />} />
          <Route path="/terms" element={<LegalPage page="terms" />} />
          <Route path="/privacy" element={<LegalPage page="privacy" />} />
        </Routes>
      </Suspense>
    );
  }
  if (publicForm || publicQuote || publicPay || publicInvite || verifyEmail) {
    return (
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/request/:token" element={<PublicRequestPage />} />
          <Route path="/quote/:token" element={<PublicQuotePage />} />
          <Route path="/pay/:token" element={<PublicInvoicePage />} />
          <Route path="/pay/:token/mock-checkout" element={<MockCheckoutPage />} />
          <Route path="/invite/:token" element={<AcceptInvitePage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
        </Routes>
      </Suspense>
    );
  }

  return (
    <div className="min-h-screen">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2 focus:shadow-pop"
      >
        Skip to content
      </a>
      <NavBar />
      <ClockBanner />
      <main id="main" className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">
        <VerifyEmailBanner />
        <Suspense fallback={<Loading />}>
          <Routes>
            {/* Where the installed app opens: straight to your jobs, or the login page. */}
            <Route path="/start" element={<Home />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            {PRIVATE.map(([path, Page, allow]) => (
              <Route
                key={path}
                path={path}
                element={
                  <ProtectedRoute allow={allow}>
                    <Page />
                  </ProtectedRoute>
                }
              />
            ))}
          </Routes>
        </Suspense>
      </main>
      <QuickAddButton />
    </div>
  );
}
