import { Component, OnInit, inject } from '@angular/core';
import { TransactionView } from '../../models/transaction-view';
import { Observable, forkJoin, map } from 'rxjs';
import { TransactionService } from '../../services/transaction-service';
import { CommonModule } from '@angular/common';
import { TransactionCard } from '../transaction-card/transaction-card';
import { CategoryPalette } from '../category-palette/category-palette';
import { CategoryService } from '../../services/category-service';
import { BankAccountService } from '../../services/bank-account-service';
import { BankAccount } from '../../models/bank-account';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-transactions-page',
  imports: [CommonModule, FormsModule, TransactionCard, CategoryPalette],
  templateUrl: './transactions-page.html',
  styleUrl: './transactions-page.scss',
})
export class TransactionsPage implements OnInit {
  vm$!: Observable<{ transactions: TransactionView[] }>;
  flatCategories: any[] = [];
  paletteCategories: any[] = [];
  accounts: BankAccount[] = [];
  selectedAccountId: number | null = null;

  isPaletteOpen = false;
  activeTransaction: TransactionView | null = null;
  activeSplitIndex: number | null = null;

  private bankAccountService = inject(BankAccountService);

  constructor(
    private transactionService: TransactionService,
    private categoryService: CategoryService,
  ) {}

  ngOnInit() {
    this.vm$ = forkJoin({
      cats: this.categoryService.getCategories(),
      trans: this.transactionService.getTransactions(),
      accs: this.bankAccountService.getActive(),
    }).pipe(
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

        return { transactions: mappedTransactions };
      }),
    );
  }

  handleOpenPalette(event: { t: TransactionView; idx: number }) {
    this.activeTransaction = event.t;
    this.activeSplitIndex = event.idx;

    // Show only income categories for positive, expense for negative.
    const rootFilter = event.t.mutation >= 0 ? 'INKOMEN' : 'UITGAVEN';
    const filtered = this.flatCategories.filter((cat) => cat.path?.startsWith(rootFilter));

    // Fallback: if the filter produces no results (e.g. category naming differs),
    // show all categories so the user isn't stuck.
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
    this.vm$ = this.transactionService.getTransactions(accountId).pipe(
      map((trans) => {
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

        return { transactions: mappedTransactions };
      }),
    );
  }

  closePalette() {
    this.isPaletteOpen = false;
    this.activeTransaction = null;
    this.activeSplitIndex = null;
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
        flatList.push({ name: item.name, path: parentPath, color: currentColor, id: item.id });
      }
    }
    return flatList;
  }
}
