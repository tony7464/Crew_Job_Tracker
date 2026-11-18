import { Link } from "react-router-dom";
import AuthScreen from "../components/AuthScreen";
import { Input } from "../components/Field";
import { useAuth } from "../context/useAuth";

export default function LoginPage() {
  const { login } = useAuth();

  return (
    <AuthScreen
      title="Welcome back"
      subtitle="Log in to see your jobs and schedule. Owners and crew use the same page."
      submitLabel="Log in"
      onSubmit={(form) =>
        login({
          username: form.get("username"),
          password: form.get("password"),
        })
      }
      footer={
        <>
          New here?{" "}
          <Link to="/signup" className="link">
            Start a business
          </Link>{" "}
          or{" "}
          <Link to="/signup?role=employee" className="link">
            join your company
          </Link>
        </>
      }
    >
      <Input
        label="Email"
        name="username"
        autoComplete="username"
        autoCapitalize="none"
        required
        hint="Have an older account? Your username works too."
      />
      <Input label="Password" name="password" type="password" autoComplete="current-password" required />
      <p className="text-right text-sm">
        <Link to="/forgot-password" className="link">
          Forgot your password?
        </Link>
      </p>
    </AuthScreen>
  );
}
