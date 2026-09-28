"use client";

import * as React from "react";
import { SearchSelect, type SearchSelectOption } from "@/components/ui/search-select";

function textOf(node: React.ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) return textOf(node.props.children);
  return "";
}

type OptionProps = { value?: string | number; children?: React.ReactNode; disabled?: boolean };
type GroupProps = { label?: string; children?: React.ReactNode };

function collectOptions(children: React.ReactNode, group?: string): SearchSelectOption[] {
  const out: SearchSelectOption[] = [];
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    if (child.type === "option") {
      const props = child.props as OptionProps;
      const label = textOf(props.children);
      out.push({
        value: props.value != null ? String(props.value) : label,
        label,
        group,
        disabled: props.disabled,
      });
    } else if (child.type === "optgroup") {
      const props = child.props as GroupProps;
      out.push(...collectOptions(props.children, props.label));
    } else if (child.type === React.Fragment) {
      out.push(...collectOptions((child.props as { children?: React.ReactNode }).children, group));
    }
  });
  return out;
}

const valueSetter =
  typeof window === "undefined"
    ? undefined
    : Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;

/**
 * Searchable select with the native `<select>` API. A hidden real select keeps
 * form submission, `form.reset()` and `onChange(event)` handlers working.
 */
export function NativeSelect({
  className,
  children,
  value,
  defaultValue,
  id,
  disabled,
  "aria-label": ariaLabel,
  ...props
}: React.ComponentProps<"select">) {
  const selectRef = React.useRef<HTMLSelectElement>(null);
  const options = React.useMemo(() => collectOptions(children), [children]);
  const controlled = value !== undefined;
  const [inner, setInner] = React.useState(() =>
    defaultValue != null ? String(defaultValue) : (options[0]?.value ?? ""),
  );
  const raw = controlled ? String(value ?? "") : inner;
  const current = options.some((option) => option.value === raw) ? raw : (options[0]?.value ?? "");

  React.useEffect(() => {
    const form = selectRef.current?.form;
    if (!form || controlled) return;
    const onReset = () => setTimeout(() => setInner(selectRef.current?.value ?? ""));
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, [controlled]);

  function choose(next: string) {
    const element = selectRef.current;
    if (!controlled) setInner(next);
    if (!element) return;
    valueSetter?.call(element, next);
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }

  return (
    <>
      <select
        ref={selectRef}
        aria-hidden
        tabIndex={-1}
        disabled={disabled}
        className="sr-only"
        {...(controlled ? { value } : { defaultValue })}
        {...props}
      >
        {children}
      </select>
      <SearchSelect
        id={id}
        aria-label={ariaLabel}
        options={options}
        value={current}
        onValueChange={choose}
        disabled={disabled}
        className={className}
      />
    </>
  );
}
