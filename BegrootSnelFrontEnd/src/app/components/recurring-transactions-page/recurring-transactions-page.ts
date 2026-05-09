import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BehaviorSubject, Observable, Subscription, debounceTime, map, startWith, switchMap } from 'rxjs';
import { RecurringTransaction, RecurrenceFrequency } from '../../models/recurring-transaction';
import { RecurringTransactionService } from '../../services/recurring-transaction-service';
import { CategoryService } from '../../services/category-service';
import { Category } from '../../models/category';
import { Transaction } from '../../models/transaction';
import { CategoryPalette } from '../category-palette/category-palette';

const FREQ_LABELS: Record<RecurrenceFrequency, string> = {
  MONTHLY: 'maand',
  QUARTERLY: 'kwartaal',
  YEARLY: 'jaar',
};

@Component({
  selector: 'app-recurring-transactions-page',
  standalone: true,
  imports: [CommonModule, FormsModule, CategoryPalette],
  templateUrl: './recurring-transactions-page.html',
  styleUrl: './recurring-transactions-page.scss',
})
export class RecurringTransactionsPage implements OnInit, OnDestroy {
  private rts = inject(RecurringTransactionService);
  private categoryService = inject(CategoryService);
  private cdr = inject(ChangeDetectorRef);

  freqLabels = FREQ_LABELS;

  private refresh$ = new BehaviorSubject<void>(undefined);

  allItems$: Observable<RecurringTransaction[]> = this.refresh$.pipe(
    debounceTime(200),
    startWith(undefined),
    switchMap(() => this.rts.getAll()),
  );

  detectedItems$ = this.allItems$.pipe(
    map((items) =>
      items
        .filter((r) => r.status === 'DETECTED')
        .sort((a, b) => b.confidenceScore - a.confidenceScore),
    ),
  );

  confirmedItems$ = this.allItems$.pipe(
    map((items) =>
      items
        .filter((r) => r.status === 'CONFIRMED')
        .sort((a, b) => {
          if (a.category && !b.category) return -1;
          if (!a.category && b.category) return 1;
          return 0;
        }),
    ),
  );

  isScanning = false;
  editingId: number | null = null;

  togglingIds = new Set<number>();

  expandedId: number | null = null;
  expandedTransactions: Transaction[] = [];
  loadingExpanded = false;
  private expandSub: Subscription | null = null;

  toggleExpand(item: RecurringTransaction) {
    // Collapse if already expanded
    if (this.expandedId === item.id) {
      this.expandedId = null;
      this.expandedTransactions = [];
      this.cancelExpandRequest();
      this.cdr.detectChanges();
      return;
    }

    // Cancel any in-flight request
    this.cancelExpandRequest();

    // Set new expanded state
    this.expandedId = item.id;
    this.loadingExpanded = true;
    this.expandedTransactions = [];
    this.cdr.detectChanges();

    // Fire request and store subscription
    this.expandSub = this.rts.getMatchingTransactions(item.id).subscribe({
      next: (txns) => {
        // Guard against stale responses
        if (this.expandedId === item.id) {
          this.expandedTransactions = txns || [];
          this.loadingExpanded = false;
          this.cdr.detectChanges();
        }
      },
      error: () => {
        if (this.expandedId === item.id) {
          this.expandedTransactions = [];
          this.loadingExpanded = false;
          this.cdr.detectChanges();
        }
      },
    });
  }

  private cancelExpandRequest() {
    if (this.expandSub) {
      this.expandSub.unsubscribe();
      this.expandSub = null;
    }
  }

  // Category palette (pre-loaded like transaction page)
  paletteCategories: any[] = [];
  isPaletteOpen = false;
  activePaletteItem: RecurringTransaction | null = null;
  activePaletteContext: any = null;

  ngOnDestroy(): void {
    this.cancelExpandRequest();
  }

  ngOnInit(): void {
    this.categoryService.getCategories().subscribe((cats) => {
      this.paletteCategories = this.flattenCategories(cats);
    });
  }

  scan() {
    this.isScanning = true;
    this.rts.scan().subscribe({
      next: (result) => {
        console.log(`Scan complete: ${result.newDetections} new detections`);
        this.isScanning = false;
        this.refresh$.next();
      },
      error: (err) => {
        console.error('Scan failed:', err);
        this.isScanning = false;
      },
    });
  }

  confirm(id: number) {
    this.rts.confirm(id).subscribe({
      next: () => this.refresh$.next(),
      error: (err) => console.error('Confirm failed:', err),
    });
  }

  dismiss(id: number) {
    this.rts.dismiss(id).subscribe({
      next: () => this.refresh$.next(),
      error: (err) => console.error('Dismiss failed:', err),
    });
  }

  deleteItem(id: number) {
    this.rts.delete(id).subscribe({
      next: () => this.refresh$.next(),
      error: (err) => console.error('Delete failed:', err),
    });
  }

  startEdit(item: RecurringTransaction) {
    this.editingId = item.id;
  }

  cancelEdit() {
    this.editingId = null;
  }

  saveEdit(item: RecurringTransaction) {
    this.rts
      .update(item.id, {
        expectedAmount: item.expectedAmount,
        frequency: item.frequency,
        autoBudget: item.autoBudget,
      })
      .subscribe({
        next: () => {
          this.editingId = null;
          this.refresh$.next();
        },
        error: (err) => console.error('Update failed:', err),
      });
  }

  toggleAutoBudget(item: RecurringTransaction) {
    this.togglingIds.add(item.id);
    this.rts.update(item.id, { autoBudget: !item.autoBudget }).subscribe({
      next: () => {
        this.togglingIds.delete(item.id);
        this.refresh$.next();
      },
      error: (err) => {
        this.togglingIds.delete(item.id);
        console.error('Toggle failed:', err);
      },
    });
  }

  // ── Category palette (same pattern as transaction page) ──────────────

  openPalette(item: RecurringTransaction) {
    this.activePaletteItem = item;
    this.activePaletteContext = {
      prettyTitle: item.displayName,
      mutation: item.isIncome ? item.expectedAmount : -item.expectedAmount,
    };
    this.isPaletteOpen = true;
  }

  closePalette() {
    this.isPaletteOpen = false;
    this.activePaletteItem = null;
  }

  handleCategorySelect(cat: any) {
    if (this.activePaletteItem) {
      const categoryPayload: any = { id: cat.id, name: cat.name };
      this.rts
        .update(this.activePaletteItem.id, {
          category: categoryPayload,
          autoBudget: this.activePaletteItem.autoBudget,
        })
        .subscribe({
          next: () => {
            this.refresh$.next();
            this.closePalette();
          },
          error: (err) => console.error('Update failed:', err),
        });
    }
  }

  // ── Confidence helpers ───────────────────────────────────────────────

  confidencePercent(score: number): number {
    return Math.round(score * 100);
  }

  confidenceClass(score: number): string {
    const pct = this.confidencePercent(score);
    if (pct >= 90) return 'conf-high';
    if (pct >= 70) return 'conf-mid';
    return 'conf-low';
  }

  confidenceLabel(score: number): string {
    const pct = this.confidencePercent(score);
    if (pct >= 90) return 'Zeer waarschijnlijk';
    if (pct >= 70) return 'Waarschijnlijk';
    return 'Mogelijk';
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
