import { Link } from "react-router-dom";
import AuthScreen from "../components/AuthScreen";
import { Input } from "../components/Field";
import { useAuth } from "../context/useAuth";

export default function SignupPage() {
  const { signup } = useAuth();

  return (
    <AuthScreen
      title="Sign up"
      submitLabel="Create account"
      onSubmit={(form) =>
        signup({
          username: form.get("username"),
          email: form.get("email"),
          password: form.get("password"),
        })
      }
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="text-sky-800 hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <Input label="Username" name="username" autoComplete="username" required />
      <Input label="Email" name="email" type="email" autoComplete="email" required />
      <Input
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
      />
      <p className="text-sm text-slate-500">At least 8 characters.</p>
    </AuthScreen>
  );
}
