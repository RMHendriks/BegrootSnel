import { TransactionSplit } from './transaction-split';
import { UploadedFile } from './uploaded-file';

export interface TransactionView {
  id: number;
  account?: {
    id: number;
    accountNumber: string;
    name: string;
    type: string;
    color?: string;
    active: boolean;
  };
  oldBalance: number;
  newBalance: number;
  transactionDate: string;
  prettyTitle: string;
  description: string;

  currency: string;
  mutation: number;

  counterpartyAccountNumber?: string;
  counterpartyName?: string;
  internalTransfer: boolean;
  transferGroupId?: string;

  splits: TransactionSplit[];
  uploadedFiles?: UploadedFile[];

  isExpanded: boolean;
  isEditingSplits: boolean;
}
