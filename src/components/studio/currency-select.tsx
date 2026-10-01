import { NativeSelect } from "@/components/ui/native-select";
import { CURRENCIES, type IsoCurrency } from "@/shared/money";

/** Every currency Worklane can bill in. The value stored is the ISO code. */
export function CurrencySelect({
  id,
  name = "currency",
  defaultValue = "USD",
  value,
  onChange,
  disabled,
  compact = false,
  className,
  ariaLabel,
}: {
  id?: string;
  name?: string;
  defaultValue?: IsoCurrency | string;
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  /** Code only, for a narrow field beside an amount. */
  compact?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <NativeSelect
      id={id}
      name={name}
      defaultValue={value == null ? defaultValue : undefined}
      value={value}
      disabled={disabled}
      className={className}
      aria-label={ariaLabel}
      onChange={onChange ? (event) => onChange(event.target.value) : undefined}
    >
      {CURRENCIES.map((currency) => (
        <option key={currency.code} value={currency.code}>
          {compact ? currency.code : `${currency.code} · ${currency.name}`}
        </option>
      ))}
    </NativeSelect>
  );
}
