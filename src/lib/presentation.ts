export const badgeToneClass = {
  success: "bg-primary/10 text-primary hover:bg-primary/10",
  warning: "bg-amber-100 text-amber-700 hover:bg-amber-100",
  info: "bg-sky-100 text-sky-700 hover:bg-sky-100",
  error: "bg-destructive/10 text-destructive hover:bg-destructive/10",
  neutral: "bg-muted text-muted-foreground hover:bg-muted",
  admin: "bg-violet-100 text-violet-700 hover:bg-violet-100",
} as const;

export function formatDisplayDate(
  value: string | Date | null,
  fallback = "Pending"
) {
  if (!value) return fallback;
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}
