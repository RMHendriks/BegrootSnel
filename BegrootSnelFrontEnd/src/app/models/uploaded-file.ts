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

/** Summary of orphaned transactions after a file is deleted. */
export interface OrphanedSummary {
  count: number;
  firstDate: string;
  lastDate: string;
  accountId: number;
  accountName: string;
  accountNumber: string;
}

/** Response from DELETE /uploads/{id}. */
export interface FileDeleteResult {
  deleted: UploadedFile;
  updatedFiles: UploadedFile[];
  orphanedTransactions: OrphanedSummary;
}
