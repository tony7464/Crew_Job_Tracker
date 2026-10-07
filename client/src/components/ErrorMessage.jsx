export default function ErrorMessage({ error }) {
  if (!error) return null;

  const lines = error.errors
    ? Object.entries(error.errors).flatMap(([field, messages]) =>
        [].concat(messages).map((message) => `${field}: ${message}`),
      )
    : [error.message];

  return (
    <p role="alert" className="text-sm text-red-700">
      {lines.join(" ")}
    </p>
  );
}
