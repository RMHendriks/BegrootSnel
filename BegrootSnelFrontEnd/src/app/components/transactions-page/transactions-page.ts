import { Component, OnInit } from '@angular/core';
import { TransactionView } from '../../models/transaction-view';
import { Observable, forkJoin, map } from 'rxjs';
import { TransactionService } from '../../services/transaction-service';
import { CommonModule } from '@angular/common';
import { TransactionCard } from '../transaction-card/transaction-card';
import { CategoryPalette } from '../category-palette/category-palette'; 
import { CategoryService } from '../../services/category-service';

@Component({
  selector: 'app-transactions-page',
  imports: [CommonModule, TransactionCard, CategoryPalette],
  templateUrl: './transactions-page.html',
  styleUrl: './transactions-page.scss',
})
export class TransactionsPage implements OnInit {
  
  vm$!: Observable<{ transactions: TransactionView[] }>;
  flatCategories: any[] = [];
  
  isPaletteOpen = false;
  activeTransaction: TransactionView | null = null;
  activeSplitIndex: number | null = null;

  constructor(private transactionService: TransactionService, private categoryService: CategoryService) {}

  ngOnInit() {
    this.vm$ = forkJoin({
      cats: this.categoryService.getCategories(),
      trans: this.transactionService.getTransactions()
    }).pipe(
      map(({ cats, trans }) => {
        this.flatCategories = this.flattenCategories(cats);
        
        const mappedTransactions: TransactionView[] = trans.map(t => ({
          ...t,
          // Init met 1 lege split als er niets is
          splits: (t.splits && t.splits.length > 0) 
            ? t.splits 
            : [{ category: null, amount: t.mutation, percentage: 100, usePercentage: false }],
          isExpanded: false,
          isEditingSplits: false
        }));

        return { transactions: mappedTransactions };
      })
    );
  }

  handleOpenPalette(event: { t: TransactionView, idx: number }) {
    this.activeTransaction = event.t;
    this.activeSplitIndex = event.idx;
    this.isPaletteOpen = true;
  }

  handleCategorySelect(cat: any) {
    if (this.activeTransaction) {
      // Safety check: zorg dat de split bestaat
      if (!this.activeTransaction.splits || this.activeTransaction.splits.length === 0) {
         this.activeTransaction.splits = [{ 
             category: null, amount: this.activeTransaction.mutation, percentage: 100, usePercentage: false 
         }];
      }

      if (this.activeSplitIndex !== null && this.activeTransaction.splits[this.activeSplitIndex]) {
        this.activeTransaction.splits[this.activeSplitIndex].category = cat;
      } else {
        // Fallback naar index 0
        this.activeTransaction.splits[0].category = cat;
      }
      this.transactionService.updateTransaction(this.activeTransaction).subscribe();
    }
    this.closePalette();
  }

  closePalette() {
    this.isPaletteOpen = false;
    this.activeTransaction = null;
    this.activeSplitIndex = null;
  }

  // Helpers
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
        flatList = [...flatList, ...this.flattenCategories(item.children, currentPath, currentColor)];
      } else {
        flatList.push({ name: item.name, path: parentPath, color: currentColor, id: item.id });
      }
    }
    return flatList;
  }
}
