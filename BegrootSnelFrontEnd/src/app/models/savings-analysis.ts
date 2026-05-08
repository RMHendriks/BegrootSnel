export interface SavingsAnalysis {
  accountId: number;
  accountName: string;
  accountNumber: string;
  currentBalance: number;
  balanceDate: string;
  monthlySnapshots: MonthlySavingsSnapshot[];
  monthOverMonthDelta: MonthOverMonthDelta;
}

export interface MonthlySavingsSnapshot {
  year: number;
  month: number;
  deposits: number;
  withdrawals: number;
  net: number;
}

export interface MonthOverMonthDelta {
  previousMonthNet: number;
  currentMonthNet: number;
  absoluteDelta: number;
  increased: boolean;
}
