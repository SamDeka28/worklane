import type { IsoCurrency } from "@/shared/money";

const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function belowThousand(n: number): string {
  const parts: string[] = [];
  if (n >= 100) {
    parts.push(`${ONES[Math.floor(n / 100)]} Hundred`);
    n %= 100;
  }
  if (n >= 20) {
    parts.push(n % 10 ? `${TENS[Math.floor(n / 10)]}-${ONES[n % 10]}` : TENS[Math.floor(n / 10)]);
  } else if (n > 0) {
    parts.push(ONES[n]);
  }
  return parts.join(" ");
}

function international(n: bigint): string {
  if (n === BigInt(0)) return "Zero";
  const scales = ["", "Thousand", "Million", "Billion", "Trillion"];
  const parts: string[] = [];
  let index = 0;
  while (n > BigInt(0) && index < scales.length) {
    const chunk = Number(n % BigInt(1000));
    if (chunk) parts.unshift([belowThousand(chunk), scales[index]].filter(Boolean).join(" "));
    n /= BigInt(1000);
    index += 1;
  }
  return parts.join(" ");
}

function indian(n: bigint): string {
  if (n === BigInt(0)) return "Zero";
  const parts: string[] = [];
  const crore = n / BigInt(10_000_000);
  n %= BigInt(10_000_000);
  if (crore > BigInt(0)) parts.push(`${indian(crore)} Crore`);
  const lakh = Number(n / BigInt(100_000));
  n %= BigInt(100_000);
  if (lakh) parts.push(`${belowThousand(lakh)} Lakh`);
  const thousand = Number(n / BigInt(1000));
  n %= BigInt(1000);
  if (thousand) parts.push(`${belowThousand(thousand)} Thousand`);
  const rest = Number(n);
  if (rest) parts.push(belowThousand(rest));
  return parts.join(" ");
}

/** "Rupees Twelve Thousand Five Hundred and Paise Fifty Only" / "US Dollars … and 50/100 Only". */
export function amountInWords(amountMinor: bigint, currency: IsoCurrency): string {
  const negative = amountMinor < BigInt(0);
  const abs = negative ? -amountMinor : amountMinor;
  const major = abs / BigInt(100);
  const minor = Number(abs % BigInt(100));
  if (currency === "INR") {
    const words = `Rupees ${indian(major)}${minor ? ` and Paise ${belowThousand(minor)}` : ""} Only`;
    return negative ? `Minus ${words}` : words;
  }
  const words = `US Dollars ${international(major)}${minor ? ` and ${String(minor).padStart(2, "0")}/100` : ""} Only`;
  return negative ? `Minus ${words}` : words;
}
