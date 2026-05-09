import { Category } from './category';

export interface RecurringTransaction {
  id: number;
  account_id: number;
  counterpartyName: string;
  displayName: string;
  descriptionPattern?: string;
  category?: Category;
  category_id?: number;
  expectedAmount: number;
  amountTolerance: number;
  frequency: RecurrenceFrequency;
  expectedDayOfMonth?: number;
  autoBudget: boolean;
  status: RecurringStatus;
  occurrenceCount: number;
  confidenceScore: number;
  firstSeenDate: string;
  lastSeenDate: string;
  isIncome: boolean;
}

export type RecurrenceFrequency = 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
export type RecurringStatus = 'DETECTED' | 'CONFIRMED' | 'DISMISSED';

export interface ScanResult {
  newDetections: number;
  detected: RecurringTransaction[];
}
