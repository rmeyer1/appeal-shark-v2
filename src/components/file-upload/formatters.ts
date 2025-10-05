export function formatCurrency(value: number | null): string | null {
  if (value === null || Number.isNaN(value)) {
    return null;
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatCurrencySigned(value: number | null): string | null {
  if (value === null || Number.isNaN(value)) {
    return null;
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
    signDisplay: "always",
  }).format(value);
}

export function formatRatePercent(value: number | null, fractionDigits = 2): string | null {
  if (value === null || Number.isNaN(value)) {
    return null;
  }

  return `${(value * 100).toFixed(fractionDigits)}%`;
}

export function formatPercentSigned(value: number | null, fractionDigits = 2): string | null {
  if (value === null || Number.isNaN(value)) {
    return null;
  }

  const percent = (value * 100).toFixed(fractionDigits);
  const sign = value > 0 ? "+" : "";
  return `${sign}${percent}%`;
}

export function formatPercentValue(value: number | null, fractionDigits = 1): string | null {
  if (value === null || Number.isNaN(value)) {
    return null;
  }

  return `${value.toFixed(fractionDigits)}%`;
}

export function formatDate(value: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
