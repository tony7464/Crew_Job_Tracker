function labeled(label, control) {
  return (
    <label className="block text-sm font-medium">
      {label}
      {control}
    </label>
  );
}

export function Input({ label, ...props }) {
  return labeled(label, <input {...props} className="field" />);
}

export function TextArea({ label, ...props }) {
  return labeled(label, <textarea {...props} className="field" />);
}

export function Select({ label, children, ...props }) {
  return labeled(label, <select {...props} className="field">{children}</select>);
}
