import { Component, OnInit, inject } from '@angular/core';
import { TransactionView } from '../../models/transaction-view';
import { Observable, Subject, forkJoin, map, startWith, switchMap } from 'rxjs';
import { TransactionService } from '../../services/transaction-service';
import { CommonModule } from '@angular/common';
import { TransactionCard } from '../transaction-card/transaction-card';
import { CategoryPalette } from '../category-palette/category-palette';
import { CategoryService } from '../../services/category-service';
import { BankAccountService } from '../../services/bank-account-service';
import { BankAccount } from '../../models/bank-account';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-transactions-page',
  imports: [CommonModule, FormsModule, RouterLink, TransactionCard, CategoryPalette],
  templateUrl: './transactions-page.html',
  styleUrl: './transactions-page.scss',
})
export class TransactionsPage implements OnInit {
  vm$!: Observable<{ transactions: TransactionView[]; accounts: BankAccount[] }>;
  flatCategories: any[] = [];
  paletteCategories: any[] = [];
  accounts: BankAccount[] = [];
  selectedAccountId: number | null = null;

  isPaletteOpen = false;
  activeTransaction: TransactionView | null = null;
  activeSplitIndex: number | null = null;

  private bankAccountService = inject(BankAccountService);

  /** Triggers a fresh fetch of transactions (and categories/accounts). */
  private refresh$ = new Subject<void>();

  constructor(
    private transactionService: TransactionService,
    private categoryService: CategoryService,
  ) {}

  ngOnInit() {
    // vm$ reacts to account changes and manual refreshes.
    // startWith ensures the first fetch fires immediately on subscription.
    this.vm$ = this.refresh$.pipe(
      startWith(undefined),
      switchMap(() =>
        forkJoin({
          cats: this.categoryService.getCategories(),
          trans: this.transactionService.getTransactions(this.selectedAccountId),
          accs: this.bankAccountService.getActive(),
        }),
      ),
      map(({ cats, trans, accs }) => {
        this.accounts = accs;
        this.flatCategories = this.flattenCategories(cats);

        const mappedTransactions: TransactionView[] = trans.map((t) => ({
          ...t,
          splits:
            t.splits && t.splits.length > 0
              ? t.splits
              : [
                  {
                    category: null,
                    amount: t.mutation,
                    percentage: 100,
                    usePercentage: false,
                    parentId: t.id,
                  },
                ],
          isExpanded: false,
          isEditingSplits: false,
        }));

        return { transactions: mappedTransactions, accounts: accs };
      }),
    );
  }

  handleOpenPalette(event: { t: TransactionView; idx: number }) {
    this.activeTransaction = event.t;
    this.activeSplitIndex = event.idx;

    const rootFilter = event.t.mutation >= 0 ? 'INKOMEN' : 'UITGAVEN';
    const filtered = this.flatCategories.filter((cat) => cat.path?.startsWith(rootFilter));

    this.paletteCategories = filtered.length > 0 ? filtered : this.flatCategories;

    this.isPaletteOpen = true;
  }

  handleCategorySelect(cat: any) {
    if (this.activeTransaction && this.activeSplitIndex !== null) {
      const splits = this.activeTransaction.splits;

      if (!splits || splits.length === 0) {
        this.activeTransaction.splits = [
          {
            category: cat,
            amount: this.activeTransaction.mutation,
            percentage: 100,
            usePercentage: false,
            parentId: this.activeTransaction.id,
          },
        ];
      } else if (splits[this.activeSplitIndex]) {
        splits[this.activeSplitIndex].category = cat;
      } else {
        splits[0].category = cat;
      }

      if (!this.activeTransaction.isEditingSplits) {
        this.transactionService.updateTransaction(this.activeTransaction).subscribe();
      }
    }
    this.closePalette();
  }

  onAccountChange(accountId: number | null): void {
    this.selectedAccountId = accountId;
    this.refresh$.next();
  }

  closePalette() {
    this.isPaletteOpen = false;
    this.activeTransaction = null;
    this.activeSplitIndex = null;
  }

  // ── Orphaned transactions ────────────────────────────────────────────

  isOrphaned(t: TransactionView): boolean {
    return !t.uploadedFiles || t.uploadedFiles.length === 0;
  }

  /** Returns the sum of orphan counts across all groups. */
  orphanTotal(
    groups: {
      accountId: number;
      accountName: string;
      accountNumber: string;
      count: number;
      firstDate: string;
      lastDate: string;
    }[],
  ): number {
    let total = 0;
    for (const g of groups) {
      total += g.count;
    }
    return total;
  }

  /** Groups orphaned transactions per account, sorted by account name. */
  buildOrphanGroups(transactions: TransactionView[]): {
    accountId: number;
    accountName: string;
    accountNumber: string;
    count: number;
    firstDate: string;
    lastDate: string;
  }[] {
    const orphans = transactions.filter((t) => !t.uploadedFiles || t.uploadedFiles.length === 0);
    if (orphans.length === 0) return [];

    const groups = new Map<number, { account: BankAccount; transactions: TransactionView[] }>();
    for (const t of orphans) {
      const acc = t.account;
      if (!acc) continue;
      if (!groups.has(acc.id)) {
        groups.set(acc.id, { account: acc as BankAccount, transactions: [] });
      }
      groups.get(acc.id)!.transactions.push(t);
    }

    return Array.from(groups.values())
      .map((g) => {
        const sorted = g.transactions.sort(
          (a, b) => new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime(),
        );
        return {
          accountId: g.account.id,
          accountName: g.account.name,
          accountNumber: g.account.accountNumber,
          count: sorted.length,
          firstDate: sorted[0].transactionDate,
          lastDate: sorted[sorted.length - 1].transactionDate,
        };
      })
      .sort((a, b) => a.accountName.localeCompare(b.accountName));
  }

  handleOrphanRemove(transaction: TransactionView): void {
    this.transactionService.deleteTransaction(transaction.id).subscribe({
      next: () => this.reloadTransactions(),
      error: (err) => console.error('Failed to delete transaction', err),
    });
  }

  handleDeleteAllOrphans(accountId: number): void {
    this.transactionService.deleteOrphanedTransactions(accountId).subscribe({
      next: () => this.reloadTransactions(),
      error: (err) => console.error('Failed to delete orphans', err),
    });
  }

  handleDeleteAllOrphansGlobally(): void {
    this.transactionService.deleteOrphanedTransactions().subscribe({
      next: () => this.reloadTransactions(),
      error: (err) => console.error('Failed to delete all orphans', err),
    });
  }

  // ── Helpers ──────────────────────────────────────────────────────────

  private reloadTransactions(): void {
    this.refresh$.next();
  }

  isNewMonth(transactions: TransactionView[], index: number): boolean {
    if (index === 0) return true;
    const current = transactions[index].transactionDate;
    const previous = transactions[index - 1].transactionDate;
    return current.substring(0, 7) !== previous.substring(0, 7);
  }

  formatMonthLabel(dateStr: string): string {
    const date = new Date(dateStr);
    return date.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' });
  }

  flattenCategories(items: any[], parentPath: string = '', parentColor: string = ''): any[] {
    let flatList: any[] = [];

    for (const item of items) {
      if (!parentPath && !item.root) continue;
      const currentColor = item.color || parentColor || '#64748b';
      const currentPath = parentPath ? `${parentPath} > ${item.name}` : item.name;

      if (item.children && item.children.length > 0) {
        flatList = [
          ...flatList,
          ...this.flattenCategories(item.children, currentPath, currentColor),
        ];
      } else {
        flatList.push({
          name: item.name,
          path: parentPath,
          color: currentColor,
          id: item.id,
        });
      }
    }
    return flatList;
  }
}
