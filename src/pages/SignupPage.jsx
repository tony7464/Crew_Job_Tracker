import { Link, useSearchParams } from "react-router-dom";
import AuthScreen from "../components/AuthScreen";
import { Input } from "../components/Field";
import { TRIAL_DAYS, planById } from "../config/plans";
import { useAuth } from "../context/useAuth";

// The plan picked on the pricing page, kept for when billing starts (a later update).
function rememberPlan(plan, yearly) {
  try {
    localStorage.setItem("cjt:plan", JSON.stringify({ plan: plan.id, yearly }));
  } catch {
    // Storage is off; the plan is picked again later.
  }
}

export default function SignupPage() {
  const { signup } = useAuth();
  const [params] = useSearchParams();
  const plan = planById(params.get("plan"));
  const yearly = params.get("billing") === "yearly";
  if (plan) rememberPlan(plan, yearly);

  return (
    <AuthScreen
      title="Create your business account"
      subtitle={
        plan
          ? `Start your ${TRIAL_DAYS}-day free trial of the ${plan.name} plan. No card needed.`
          : `Start your ${TRIAL_DAYS}-day free trial. No card needed. Employees get their logins from you.`
      }
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
