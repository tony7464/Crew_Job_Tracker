import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import AuthScreen from "../components/AuthScreen";
import { Input } from "../components/Field";
import { Alert } from "../components/ui/Feedback";
import { TRIAL_DAYS, planById } from "../config/plans";
import { useAuth } from "../context/useAuth";
import { cx } from "../components/ui/styles";

// The plan picked on the pricing page, kept for when billing starts (a later update).
function rememberPlan(plan, yearly) {
  try {
    localStorage.setItem("cjt:plan", JSON.stringify({ plan: plan.id, yearly }));
  } catch {
    // Storage is off; the plan is picked again later.
  }
}

const ROLES = [
  { id: "owner", label: "Owner", hint: "I run the business" },
  { id: "manager", label: "Manager", hint: "I run jobs and the team" },
  { id: "employee", label: "Employee", hint: "I work on the crew" },
];

function RolePicker({ value, onChange }) {
  return (
    <fieldset>
      <legend className="mb-1.5 block text-sm font-medium text-fg">I am the</legend>
      <div className="grid grid-cols-3 gap-2">
        {ROLES.map((role) => (
          <label
            key={role.id}
            className={cx(
              "flex cursor-pointer flex-col rounded-lg border px-2.5 py-2 text-center transition-colors",
              value === role.id ? "border-primary bg-primary-soft ring-1 ring-primary" : "border-border hover:bg-subtle",
            )}
          >
            <input
              type="radio"
              name="role"
              value={role.id}
              checked={value === role.id}
              onChange={() => onChange(role.id)}
              className="sr-only"
            />
            <span className="text-sm font-semibold text-fg">{role.label}</span>
            <span className="mt-0.5 text-[11px] leading-tight text-muted">{role.hint}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function RequestSent({ result }) {
  return (
    <section className="mx-auto w-full max-w-sm pt-4 text-center sm:pt-12">
      <h1 className="text-2xl font-semibold tracking-tight">Request sent</h1>
      <Alert tone="success" className="mt-6 text-left" title={`Waiting for ${result.business_name || "the owner"}`}>
        We let them know you signed up. You can log in with your email and password as soon as they approve you.
      </Alert>
      <p className="mt-4 text-sm text-muted">
        We also emailed you a link to confirm your email address.
      </p>
      <p className="mt-6 text-sm">
        <Link to="/login" className="link">
          Go to log in
        </Link>
      </p>
    </section>
  );
}

export default function SignupPage() {
  const { signup } = useAuth();
  const [params] = useSearchParams();
  const plan = planById(params.get("plan"));
  const yearly = params.get("billing") === "yearly";
  if (plan) rememberPlan(plan, yearly);
  // A join link from an owner (/signup?code=ABCD-EFGH) starts on Employee with the code filled in.
  const sharedCode = params.get("code") || "";
  const [role, setRole] = useState(() => {
    const asked = params.get("role");
    if (ROLES.some((option) => option.id === asked)) return asked;
    return sharedCode ? "employee" : "owner";
  });
  const [sent, setSent] = useState(null);
  const owner = role === "owner";

  if (sent) return <RequestSent result={sent} />;

  return (
    <AuthScreen
      title={owner ? "Create your business account" : "Join your company"}
      subtitle={
        owner
          ? plan
            ? `Start your ${TRIAL_DAYS}-day free trial of the ${plan.name} plan. No card needed.`
            : `Start your ${TRIAL_DAYS}-day free trial. No card needed.`
          : "Ask your employer for the company code. They approve you before you can log in."
      }
      submitLabel={owner ? "Create account" : "Ask to join"}
      onSubmit={async (form) => {
        const body = {
          first_name: form.get("first_name"),
          last_name: form.get("last_name"),
          email: form.get("email"),
          password: form.get("password"),
          role,
        };
        if (owner) body.business_name = form.get("business_name");
        else body.join_code = form.get("join_code");
        const result = await signup(body);
        if (result.pending) setSent(result);
      }}
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="link">
            Log in
          </Link>
        </>
      }
    >
      <RolePicker value={role} onChange={setRole} />
      <div className="grid grid-cols-2 gap-3">
        <Input label="First name" name="first_name" autoComplete="given-name" maxLength={60} required />
        <Input label="Last name" name="last_name" autoComplete="family-name" maxLength={60} required />
      </div>
      {owner ? (
        <Input
          key="business"
          label="Company name"
          name="business_name"
          autoComplete="organization"
          maxLength={100}
          required
          hint="Your customers see this on quotes, invoices, and texts."
        />
      ) : (
        <Input
          key="code"
          label="Company code"
          name="join_code"
          defaultValue={sharedCode}
          autoCapitalize="characters"
          autoComplete="off"
          placeholder="ABCD-EFGH"
          maxLength={32}
          required
          hint="The owner finds it on their Employees page."
        />
      )}
      <Input label="Email" name="email" type="email" autoComplete="email" autoCapitalize="none" required />
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
