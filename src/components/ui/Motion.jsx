import { cx } from "./styles";
import { tiltHandlers, useCountUp, useReveal } from "./useMotion";

// A card that leans toward the pointer, with a glare that follows it.
export function TiltCard({ as = "div", max = 7, className, children, ...rest }) {
  const Tag = as;
  return (
    <Tag className={cx("tilt", className)} {...tiltHandlers(max)} {...rest}>
      {children}
    </Tag>
  );
}

// A number that counts up to value. format turns the whole number into text (such as formatMoney).
export function CountUp({ value, format = String, duration }) {
  return format(useCountUp(value, duration));
}

// Fades and rises in the first time it scrolls into view. delay: milliseconds.
export function Reveal({ as = "div", delay = 0, className, children, ...rest }) {
  const Tag = as;
  const ref = useReveal();
  return (
    <Tag ref={ref} className={cx("reveal", className)} style={{ "--reveal-delay": `${delay}ms` }} {...rest}>
      {children}
    </Tag>
  );
}
