import { Component, OnInit, ChangeDetectorRef, ViewChild, ElementRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BankAccountService } from '../../services/bank-account-service';
import { UploadService } from '../../services/upload-service';
import { BankAccount } from '../../models/bank-account';
import { UploadedFile, FileDeleteResult } from '../../models/uploaded-file';

interface Gap {
  fileId: number;
  from: string;
  to: string;
}

interface TimelineEntry {
  kind: 'file' | 'gap';
  file?: UploadedFile;
  gap?: Gap;
}

@Component({
  selector: 'app-account-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './account-page.html',
  styleUrl: './account-page.scss',
})
export class AccountPage implements OnInit {
  @ViewChild('fileInput') fileInputRef!: ElementRef<HTMLInputElement>;

  private accountService = inject(BankAccountService);
  private uploadService = inject(UploadService);
  private cdr = inject(ChangeDetectorRef);

  // ── State ──────────────────────────────────────────────────────────────
  accounts: BankAccount[] = [];
  selectedAccountId: number | null = null;
  files: UploadedFile[] = [];
  isLoading = true;
  error: string | null = null;

  // Upload state
  isDragOver = false;
  isUploading = false;
  lastUploaded: string | null = null;

  // New account prompt (when importing unknown account)
  showNewAccountPrompt = false;
  detectedAccountNumber = '';
  newAccountForm = { name: '', type: 'PAYMENT' as 'PAYMENT' | 'SAVINGS' };
  pendingFile: File | null = null;

  // Edit selected account
  isEditingAccount = false;
  editForm = { name: '', type: 'PAYMENT' as 'PAYMENT' | 'SAVINGS' };

  // Add account manually
  showAddAccount = false;
  addForm = { accountNumber: '', name: '', type: 'PAYMENT' as 'PAYMENT' | 'SAVINGS' };

  ngOnInit(): void {
    this.loadAccounts();
  }

  // ── Data loading ───────────────────────────────────────────────────────

  loadAccounts(): void {
    this.isLoading = true;
    this.accountService.getAll().subscribe({
      next: (accounts) => {
        this.accounts = accounts;
        this.isLoading = false;
        // Auto-select first account if none selected
        if (!this.selectedAccountId && accounts.length > 0) {
          this.selectedAccountId = accounts[0].id;
          this.loadFiles();
        } else if (this.selectedAccountId) {
          // Verify selected still exists
          const stillExists = accounts.some((a) => a.id === this.selectedAccountId);
          if (!stillExists) {
            this.selectedAccountId = accounts.length > 0 ? accounts[0].id : null;
          }
          this.loadFiles();
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to load accounts', err);
        this.error = 'Kon rekeningen niet laden.';
        this.isLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  loadFiles(): void {
    if (!this.selectedAccountId) {
      this.files = [];
      return;
    }
    this.uploadService.getUploadedFilesForAccount(this.selectedAccountId).subscribe({
      next: (files) => {
        this.files = files;
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Failed to load files', err),
    });
  }

  // ── Account selection ──────────────────────────────────────────────────

  get selectedAccount(): BankAccount | null {
    return this.accounts.find((a) => a.id === this.selectedAccountId) || null;
  }

  onAccountChanged(): void {
    this.cdr.detectChanges();
    this.loadFiles();
  }

  // ── Account editing ────────────────────────────────────────────────────

  startEditAccount(): void {
    const acc = this.selectedAccount;
    if (!acc) return;
    this.editForm = { name: acc.name, type: acc.type };
    this.isEditingAccount = true;
  }

  cancelEditAccount(): void {
    this.isEditingAccount = false;
  }

  saveEditAccount(): void {
    const acc = this.selectedAccount;
    if (!acc || !this.editForm.name.trim()) return;

    const updated: BankAccount = {
      ...acc,
      name: this.editForm.name.trim(),
      type: this.editForm.type,
    };
    this.accountService.update(acc.id, updated).subscribe({
      next: () => {
        this.loadAccounts();
        this.isEditingAccount = false;
      },
      error: (err) => {
        console.error('Failed to update account', err);
        this.error = 'Kon rekening niet bijwerken.';
        this.cdr.detectChanges();
      },
    });
  }

  // ── Add account (manual) ───────────────────────────────────────────────

  startAddAccount(): void {
    this.showAddAccount = true;
    this.addForm = { accountNumber: '', name: '', type: 'PAYMENT' };
  }

  cancelAddAccount(): void {
    this.showAddAccount = false;
  }

  submitAddAccount(): void {
    if (!this.addForm.accountNumber.trim() || !this.addForm.name.trim()) return;

    const newAccount: BankAccount = {
      id: 0,
      accountNumber: this.addForm.accountNumber.trim(),
      name: this.addForm.name.trim(),
      type: this.addForm.type,
      active: true,
    };
    this.accountService.create(newAccount).subscribe({
      next: (created) => {
        this.loadAccounts();
        this.selectedAccountId = created.id;
        this.showAddAccount = false;
      },
      error: (err) => {
        console.error('Failed to create account', err);
        this.error = err.error?.error || 'Kon rekening niet aanmaken.';
        this.cdr.detectChanges();
      },
    });
  }

  // ── Delete account ─────────────────────────────────────────────────────

  deleteAccount(): void {
    const acc = this.selectedAccount;
    if (!acc || !confirm(`Weet je zeker dat je "${acc.name}" wilt verwijderen?`)) return;
    this.accountService.delete(acc.id).subscribe({
      next: () => {
        this.selectedAccountId = null;
        this.files = [];
        this.loadAccounts();
      },
      error: (err) => {
        console.error('Failed to delete account', err);
        this.error = err.error?.error || 'Kon rekening niet verwijderen.';
        this.cdr.detectChanges();
      },
    });
  }

  // ─── Upload ────────────────────────────────────────────────────────────

  openPicker(): void {
    this.fileInputRef.nativeElement.click();
  }

  onDragOver(e: DragEvent): void {
    e.preventDefault();
    this.isDragOver = true;
  }

  onDragLeave(e: DragEvent): void {
    e.preventDefault();
    this.isDragOver = false;
  }

  onDrop(e: DragEvent): void {
    e.preventDefault();
    this.isDragOver = false;
    const file = e.dataTransfer?.files?.[0];
    if (file) this.handleFile(file);
  }

  onFileSelected(e: Event): void {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.handleFile(file);
    input.value = '';
  }

  private handleFile(file: File): void {
    if (!file.name.match(/\.tab$/i)) {
      this.error = 'Alleen .TAB bestanden zijn toegestaan.';
      this.cdr.detectChanges();
      return;
    }

    this.error = null;
    this.extractAccountNumber(file)
      .then((accountNumber) => {
        // Check if this account is known
        const known = this.accounts.find((a) => a.accountNumber === accountNumber);
        if (known) {
          // Switch to this account and upload
          this.selectedAccountId = known.id;
          this.uploadFile(file);
        } else {
          // Unknown account — show prompt
          this.detectedAccountNumber = accountNumber;
          this.newAccountForm = { name: 'Rekening ' + accountNumber, type: 'PAYMENT' };
          this.pendingFile = file;
          this.showNewAccountPrompt = true;
          this.cdr.detectChanges();
        }
      })
      .catch((err) => {
        console.error('Failed to extract account number', err);
        this.error = 'Kon rekeningnummer niet uit bestand lezen.';
        this.cdr.detectChanges();
      });
  }

  private extractAccountNumber(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const lines = text.split('\n');
        for (const line of lines) {
          const columns = line.split('\t');
          if (columns.length >= 8 && columns[0].trim()) {
            resolve(columns[0].trim());
            return;
          }
        }
        reject(new Error('No account number found'));
      };
      reader.onerror = () => reject(new Error('Read error'));
      reader.readAsText(file);
    });
  }

  // ── New account prompt ─────────────────────────────────────────────────

  confirmNewAccount(): void {
    if (!this.newAccountForm.name.trim()) return;

    const newAccount: BankAccount = {
      id: 0,
      accountNumber: this.detectedAccountNumber,
      name: this.newAccountForm.name.trim(),
      type: this.newAccountForm.type,
      active: true,
    };

    this.accountService.create(newAccount).subscribe({
      next: (created) => {
        this.showNewAccountPrompt = false;
        this.selectedAccountId = created.id;
        this.loadAccounts();
        // Now upload the pending file
        if (this.pendingFile) {
          this.uploadFile(this.pendingFile);
          this.pendingFile = null;
        }
      },
      error: (err) => {
        console.error('Failed to create account', err);
        this.error = 'Kon rekening niet aanmaken.';
        this.showNewAccountPrompt = false;
        this.cdr.detectChanges();
      },
    });
  }

  cancelNewAccount(): void {
    this.showNewAccountPrompt = false;
    this.pendingFile = null;
    this.detectedAccountNumber = '';
  }

  // ── Actual upload ──────────────────────────────────────────────────────

  private uploadFile(file: File): void {
    this.lastUploaded = null;
    this.isUploading = true;
    this.cdr.detectChanges();

    this.uploadService.uploadFile(file).subscribe({
      next: (uploaded) => {
        this.isUploading = false;
        this.lastUploaded = `${uploaded.filename} (${uploaded.transactionCount} nieuwe transacties${uploaded.duplicateCount > 0 ? ', ' + uploaded.duplicateCount + ' duplicaten overgeslagen' : ''})`;
        this.loadFiles();
        // Also reload accounts to get updated balance
        this.loadAccounts();
      },
      error: (err) => {
        this.isUploading = false;
        this.error = 'Upload mislukt. Controleer het bestand en probeer opnieuw.';
        console.error('Upload failed', err);
        this.cdr.detectChanges();
      },
    });
  }

  // ── Timeline ───────────────────────────────────────────────────────────

  get timeline(): TimelineEntry[] {
    const entries: TimelineEntry[] = [];
    for (let i = 0; i < this.files.length; i++) {
      const file = this.files[i];
      if (file.hasGap && i > 0) {
        const predecessor = this.files[i - 1];
        entries.push({ kind: 'gap', gap: this.buildGapRange(predecessor, file) });
      }
      entries.push({ kind: 'file', file });
    }
    return entries;
  }

  private buildGapRange(predecessor: UploadedFile, file: UploadedFile): Gap {
    const from = new Date(predecessor.endDate);
    from.setDate(from.getDate() + 1);
    const to = new Date(file.startDate);
    to.setDate(to.getDate() - 1);
    return {
      fileId: file.id,
      from: from.toISOString().split('T')[0],
      to: to.toISOString().split('T')[0],
    };
  }

  // ── Gap dismissal ──────────────────────────────────────────────────────

  dismissGap(gap: Gap): void {
    this.uploadService.acknowledgeGap(gap.fileId).subscribe({
      next: () => this.loadFiles(),
      error: (err) => console.error('Failed to acknowledge gap', err),
    });
  }

  // ── File deletion ──────────────────────────────────────────────────────

  deleteFile(file: UploadedFile, event: MouseEvent): void {
    event.stopPropagation();
    this.uploadService.deleteUploadedFile(file.id).subscribe({
      next: (result: FileDeleteResult) => {
        // Use the recalculated files directly so counts and gaps update immediately
        this.files = result.updatedFiles;
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Delete failed', err),
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────────

  getTypeLabel(type: string): string {
    return type === 'PAYMENT' ? 'Betaalrekening' : 'Spaarrekening';
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('nl-NL', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  formatDateShort(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('nl-NL', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }
}
