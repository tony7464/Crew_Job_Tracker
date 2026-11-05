import { Link } from "react-router-dom";
import AuthScreen from "../components/AuthScreen";
import { Input } from "../components/Field";
import { useAuth } from "../context/useAuth";

export default function SignupPage() {
  const { signup } = useAuth();

  return (
    <AuthScreen
      title="Create your business account"
      subtitle="Track clients, jobs, and your crew in one place. Employees get their logins from you."
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
          <Link to="/login" className="link">
            Log in
          </Link>
        </>
      }
    >
      <Input label="Username" name="username" autoComplete="username" autoCapitalize="none" required />
      <Input label="Email" name="email" type="email" autoComplete="email" required />
      <Input
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        hint="At least 8 characters."
      />
    </AuthScreen>
  );
}
