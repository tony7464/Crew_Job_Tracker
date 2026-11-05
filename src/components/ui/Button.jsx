import { Link } from "react-router-dom";
import { buttonClass } from "./styles";

// variant: primary | secondary | ghost | soft | danger | danger-outline. size: sm | md | lg | icon.
export function Button({ variant, size, block, className, type = "button", ...props }) {
  return <button type={type} className={buttonClass({ variant, size, block, className })} {...props} />;
}

export function ButtonLink({ variant, size, block, className, ...props }) {
  return <Link className={buttonClass({ variant, size, block, className })} {...props} />;
}
