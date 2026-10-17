import { Link } from "react-router-dom";
import AuthScreen from "../components/AuthScreen";
import { Input } from "../components/Field";
import { useAuth } from "../context/useAuth";

export default function LoginPage() {
  const { login } = useAuth();

  return (
    <AuthScreen
      title="Log in"
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
          <Link to="/signup" className="text-sky-800 hover:underline">
            Sign up
          </Link>
        </>
      }
    >
      <Input label="Username" name="username" autoComplete="username" required />
      <Input
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
      />
    </AuthScreen>
  );
}
