import { Navigate, Route, Routes } from "react-router-dom";
import NavBar from "./components/NavBar";
import ProtectedRoute from "./components/ProtectedRoute";
import Loading from "./components/Loading";
import { useAuth } from "./context/useAuth";
import ClientDetail from "./pages/ClientDetail";
import ClientsPage from "./pages/ClientsPage";
import DashboardPage from "./pages/DashboardPage";
import JobDetail from "./pages/JobDetail";
import JobsPage from "./pages/JobsPage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";

const PRIVATE = [
  ["/dashboard", DashboardPage],
  ["/jobs", JobsPage],
  ["/jobs/:id", JobDetail],
  ["/clients", ClientsPage],
  ["/clients/:id", ClientDetail],
];

function Home() {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  return <Navigate to={user ? "/dashboard" : "/login"} replace />;
}

export default function App() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <NavBar />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          {PRIVATE.map(([path, Page]) => (
            <Route
              key={path}
              path={path}
              element={
                <ProtectedRoute>
                  <Page />
                </ProtectedRoute>
              }
            />
          ))}
        </Routes>
      </main>
    </div>
  );
}
