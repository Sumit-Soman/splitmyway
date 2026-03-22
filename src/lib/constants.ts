export const CURRENCIES = [
  { value: "USD", label: "USD ($)", symbol: "$" },
  { value: "EUR", label: "EUR (€)", symbol: "€" },
  { value: "GBP", label: "GBP (£)", symbol: "£" },
  { value: "INR", label: "INR (₹)", symbol: "₹" },
  { value: "JPY", label: "JPY (¥)", symbol: "¥" },
  { value: "CAD", label: "CAD (C$)", symbol: "C$" },
  { value: "AUD", label: "AUD (A$)", symbol: "A$" },
  { value: "AED", label: "AED (د.إ)", symbol: "د.إ" },
  { value: "NOK", label: "NOK (kr)", symbol: "kr" },
] as const;

export const GROUP_CATEGORIES = [
  { value: "trip", label: "Trip" },
  { value: "home", label: "Home" },
  { value: "food", label: "Food & Dining" },
  { value: "other", label: "Other" },
] as const;

export const EXPENSE_CATEGORIES = [
  { value: "general", label: "General" },
  { value: "food", label: "Food & Drink" },
  { value: "transport", label: "Transport" },
  { value: "utilities", label: "Utilities" },
  { value: "entertainment", label: "Entertainment" },
  { value: "other", label: "Other" },
] as const;

export const SPLIT_METHODS = [
  { value: "equal", label: "Equal" },
  { value: "exact", label: "Exact amounts" },
  { value: "percentage", label: "Percentage" },
  { value: "shares", label: "Shares" },
] as const;

export const ACTIVITY_TYPES = {
  EXPENSE_ADDED: "expense_added",
  EXPENSE_DELETED: "expense_deleted",
  SETTLEMENT_RECORDED: "settlement_recorded",
  MEMBER_ADDED: "member_added",
  MEMBER_REMOVED: "member_removed",
  GROUP_CREATED: "group_created",
  GROUP_DELETED: "group_deleted",
} as const;
