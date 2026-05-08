import { TransactionSplit } from './transaction-split';
import { UploadedFile } from './uploaded-file';

export interface Transaction {
  id: number;
  account?: {
    id: number;
    accountNumber: string;
    name: string;
    type: string;
    color?: string;
    active: boolean;
  };
  currency: string;

  oldBalance: number;
  newBalance: number;
  mutation: number;

  transactionDate: string;

  prettyTitle: string;
  description: string;

  counterpartyAccountNumber?: string;
  counterpartyName?: string;
  internalTransfer: boolean;
  transferGroupId?: string;

  splits: TransactionSplit[];
  uploadedFiles?: UploadedFile[];
}
