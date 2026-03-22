export type ActionResult<T = unknown> =
  | { success: true; data?: T; message?: string }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

export type SerializedExpense = {
  id: string;
  groupId: string;
  paidById: string;
  description: string;
  amount: number;
  currency: string;
  originalAmount: number | null;
  originalCurrency: string | null;
  exchangeRate: number | null;
  category: string;
  date: string;
  notes: string | null;
  receiptUrl: string | null;
  splitMethod: string;
  createdAt: string;
  updatedAt: string;
  paidBy: {
    id: string;
    name: string | null;
    email: string;
    avatarUrl: string | null;
  };
  participants: Array<{
    id: string;
    userId: string;
    amount: number;
    shares: number | null;
    percentage: number | null;
    user: {
      id: string;
      name: string | null;
      email: string;
      avatarUrl: string | null;
    };
  }>;
};

export type BalanceRow = {
  userId: string;
  name: string | null;
  email: string;
  balance: number;
};

export type DebtSuggestion = {
  fromId: string;
  toId: string;
  amount: number;
  fromName: string | null;
  toName: string | null;
};
