export interface BankAccount {
  id: number;
  accountNumber: string;
  name: string;
  type: 'PAYMENT' | 'SAVINGS';
  color?: string;
  active: boolean;
  currentBalance?: number;
  balanceDate?: string;
}
