export interface UploadedFile {
  id: number;
  filename: string;
  account?: { id: number; accountNumber: string; name: string; type: string };
  startDate: string; // ISO date "2025-01-01"
  endDate: string; // ISO date "2025-01-31"
  transactionCount: number; // new transactions added (duplicates excluded)
  duplicateCount: number; // transactions already present in the DB
  uploadedAt: string; // ISO datetime
  gapDismissed: boolean; // persisted: user has acknowledged the gap before this file
  hasGap: boolean; // computed by backend: show gap warning before this file in the timeline
}
