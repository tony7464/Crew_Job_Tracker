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
          New business?{" "}
          <Link to="/signup" className="link">
            Create an account
          </Link>
        </>
      }
    >
      <Input label="Username" name="username" autoComplete="username" autoCapitalize="none" required />
      <Input label="Password" name="password" type="password" autoComplete="current-password" required />
    </AuthScreen>
  );
}
