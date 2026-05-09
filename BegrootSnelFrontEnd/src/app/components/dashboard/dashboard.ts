import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  BehaviorSubject,
  catchError,
  combineLatest,
  debounceTime,
  forkJoin,
  map,
  Observable,
  of,
  shareReplay,
  switchMap,
  take,
} from 'rxjs';
import { ReportService } from '../../services/report-service';
import { CategoryService } from '../../services/category-service';
import { BankAccountService } from '../../services/bank-account-service';
import { Report } from '../../models/report';
import { BankAccount } from '../../models/bank-account';
import { TransactionCategoryGroup } from '../../models/transaction-category-group';
import { Category } from '../../models/category';
import { DashboardDetailView } from '../dashboard-detail-view/dashboard-detail-view';
import { BudgetService } from '../../services/budget-service';
import { RecurringTransactionService } from '../../services/recurring-transaction-service';
import { RecurringTransaction } from '../../models/recurring-transaction';
import { Budget } from '../../models/budget';
import { SavingsAnalysis } from '../../models/savings-analysis';

interface ReportParams {
  year?: number;
  month?: number;
  start?: string;
  end?: string;
}

interface GroupedCategory {
  level1: Category;
  groups: TransactionCategoryGroup[];
  subTotal: number;
}

interface SummaryData {
  totalIncome: number;
  totalBudgeted: number;
  totalSpent: number;
  difference: number;
}

interface AccountWithAnalysis {
  account: BankAccount;
  analysis: SavingsAnalysis | null;
}

function lastDayOfMonth(year: number, month: number): string {
  const lastDay = new Date(year, month, 0).getDate();
  const m = String(month).padStart(2, '0');
  const d = String(lastDay).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

const MONTH_LETTERS = ['', 'J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, DashboardDetailView],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements OnInit {
  private reportService = inject(ReportService);
  private categoryService = inject(CategoryService);
  private budgetService = inject(BudgetService);
  private bankAccountService = inject(BankAccountService);
  private recurringService = inject(RecurringTransactionService);

  filterMode: 'month' | 'range' = 'month';
  selectedYear = 2025;
  selectedMonth = 12;
  customStartDate = '';
  customEndDate = '';

  isSummaryExpanded = false;

  availableYears = [2025, 2026];
  months = [
    { value: 1, label: 'Januari' },
    { value: 2, label: 'Februari' },
    { value: 3, label: 'Maart' },
    { value: 4, label: 'April' },
    { value: 5, label: 'Mei' },
    { value: 6, label: 'Juni' },
    { value: 7, label: 'Juli' },
    { value: 8, label: 'Augustus' },
    { value: 9, label: 'September' },
    { value: 10, label: 'Oktober' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' },
  ];

  private params$ = new BehaviorSubject<ReportParams>({
    year: this.selectedYear,
    month: this.selectedMonth,
  });

  private balanceDate$ = this.params$.pipe(
    map((p) => {
      if (p.start && p.end) return p.end;
      return lastDayOfMonth(p.year!, p.month!);
    }),
  );

  accounts$ = this.balanceDate$.pipe(
    switchMap((date) => this.bankAccountService.getActive(date)),
    shareReplay(1),
  );

  accountAnalyses$ = combineLatest([this.accounts$, this.params$]).pipe(
    debounceTime(50),
    switchMap(([accounts, p]) => {
      if (accounts.length === 0) return of(new Map<number, SavingsAnalysis>());
      return forkJoin(
        accounts.map((a) => this.bankAccountService.getSavingsAnalysis(a.id, 6, p.year, p.month)),
      ).pipe(
        map((analyses) => {
          const map = new Map<number, SavingsAnalysis>();
          analyses.forEach((a) => map.set(a.accountId, a));
          return map;
        }),
      );
    }),
    shareReplay(1),
  );

  private allCategories$ = this.categoryService.getCategories().pipe(shareReplay(1));

  report$ = this.params$.pipe(
    switchMap((p) => {
      if (p.start && p.end) return this.reportService.getReport(p.start, p.end);
      return this.reportService.getReportByYearAndMonth(p.year!, p.month!);
    }),
    shareReplay(1),
  );

  private refreshBudgets$ = new BehaviorSubject<void>(undefined);

  budgets$ = combineLatest([this.params$, this.refreshBudgets$]).pipe(
    switchMap(([p]) => {
      if (p.year && p.month) return this.budgetService.getBudgets(p.year, p.month);
      return of([]);
    }),
    shareReplay(1),
  );

  missingBudgets$ = combineLatest([this.params$, this.refreshBudgets$]).pipe(
    switchMap(([p]) => {
      if (p.year && p.month) return this.recurringService.getMissingBudgets(p.year, p.month);
      return of([]);
    }),
    catchError(() => of([])),
    shareReplay(1),
  );

  vm$ = combineLatest({
    report: this.report$,
    allCategories: this.allCategories$,
    budgets: this.budgets$,
    roots: this.allCategories$.pipe(map((cats) => cats.filter((c) => c.parentId == null))),
    accounts: this.accounts$,
    accountAnalyses: this.accountAnalyses$,
  }).pipe(
    map(({ report, allCategories, budgets, roots, accounts, accountAnalyses }) => {
      const categoryMap = new Map(allCategories.map((c) => [c.id, c]));
      const budgetMap = new Map(budgets.map((b) => [b.category.id, b]));
      const allGroups = (report as any).transactionCategoryGroupDtoList || [];
      let totalIncome = 0,
        totalBudgeted = 0,
        totalSpent = 0;

      allGroups.forEach((g: TransactionCategoryGroup) => {
        const fb = budgetMap.get(g.category.id);
        if (fb) g.budgetedAmount = fb.amount;
        else g.budgetedAmount = 0;
        const root = this.findRootForCategory(g.category.id, categoryMap);
        if (root?.name.toUpperCase() === 'INKOMSTEN') totalIncome += g.actualAmount;
        else if (root?.name.toUpperCase() === 'UITGAVEN') {
          totalSpent += g.actualAmount;
          totalBudgeted += g.budgetedAmount;
        }
      });

      return {
        report,
        roots,
        categoryMap,
        summary: { totalIncome, totalBudgeted, totalSpent, difference: totalIncome - totalSpent },
        budgets,
        accounts,
        enrichedAccounts: accounts.map((acc) => ({
          account: acc,
          analysis: accountAnalyses.get(acc.id) ?? null,
        })),
        accountAnalyses,
      };
    }),
  );

  ngOnInit(): void {}

  setFilterMode(mode: 'month' | 'range') {
    this.filterMode = mode;
  }
  onMonthYearChange() {
    this.params$.next({ year: this.selectedYear, month: this.selectedMonth });
  }
  onRangeChange() {
    if (this.customStartDate && this.customEndDate)
      this.params$.next({ start: this.customStartDate, end: this.customEndDate });
  }

  incrementMonth() {
    if (this.selectedYear >= Math.max(...this.availableYears) && this.selectedMonth === 12) return;
    if (this.selectedMonth === 12) {
      this.selectedMonth = 1;
      this.selectedYear++;
    } else this.selectedMonth++;
    this.onMonthYearChange();
  }
  decrementMonth() {
    if (this.selectedYear <= Math.min(...this.availableYears) && this.selectedMonth === 1) return;
    if (this.selectedMonth === 1) {
      this.selectedMonth = 12;
      this.selectedYear--;
    } else this.selectedMonth--;
    this.onMonthYearChange();
  }

  private getAllChildIds(category: Category): number[] {
    let ids: number[] = [Number(category.id)];
    if (category.children && Array.isArray(category.children))
      category.children.forEach((child) => {
        ids = [...ids, ...this.getAllChildIds(child)];
      });
    return ids;
  }

  getGroupsByRoot(
    report: Report,
    rootCategory: Category,
    categoryMap: Map<number, Category>,
  ): TransactionCategoryGroup[] {
    const allGroups = (report as any).transactionCategoryGroupDtoList || [];
    if (!allGroups.length || !rootCategory || !categoryMap.size) return [];
    return allGroups.filter((group: TransactionCategoryGroup) => {
      let current = group.category;
      if (!current) return false;
      let safetyBreak = 0;
      while (current && (current as any).parentId != null && safetyBreak < 10) {
        const parentId = (current as any).parentId;
        if (!parentId) break;
        current = categoryMap.get(parentId)!;
        safetyBreak++;
      }
      return current && current.id === rootCategory.id;
    });
  }

  calculateRootTotal(groups: TransactionCategoryGroup[]): number {
    return groups.reduce((sum, g) => sum + g.actualAmount, 0);
  }

  getLevel1Groups(
    report: Report,
    root: Category,
    categoryMap: Map<number, Category>,
  ): GroupedCategory[] {
    const groups = this.getGroupsByRoot(report, root, categoryMap);
    const groupedMap = new Map<number, GroupedCategory>();
    groups.forEach((g) => {
      let level1: Category | undefined;
      const catFromMap = categoryMap.get(g.category.id);
      if (catFromMap && catFromMap.parentId) level1 = categoryMap.get(catFromMap.parentId);
      if (level1) {
        if (!groupedMap.has(level1.id))
          groupedMap.set(level1.id, { level1, groups: [], subTotal: 0 });
        const entry = groupedMap.get(level1.id)!;
        entry.groups.push(g);
        entry.subTotal += g.actualAmount;
      }
    });
    return Array.from(groupedMap.values());
  }

  private findRootForCategory(
    categoryId: number,
    categoryMap: Map<number, Category>,
  ): Category | undefined {
    let current = categoryMap.get(categoryId);
    let safety = 0;
    while (current && (current as any).parentId != null && safety < 10) {
      const parentId = (current as any).parentId;
      if (!parentId) break;
      current = categoryMap.get(parentId);
      safety++;
    }
    return current;
  }

  getLeftGroups(groups: GroupedCategory[]): GroupedCategory[] {
    return groups.slice(0, Math.ceil(groups.length / 2));
  }
  getRightGroups(groups: GroupedCategory[]): GroupedCategory[] {
    return groups.slice(Math.ceil(groups.length / 2));
  }

  calculateRootTotalByName(vm: any, rootName: string): number {
    const root = vm.roots.find((r: any) => r.name.toUpperCase() === rootName.toUpperCase());
    if (!root) return 0;
    return this.calculateRootTotal(this.getGroupsByRoot(vm.report, root, vm.categoryMap));
  }

  sparklineBarWidths(analysis: SavingsAnalysis): string[] {
    const nets = analysis.monthlySnapshots.map((s) => Math.abs(s.net));
    const max = Math.max(...nets, 1);
    // 50% = full half-height (11 px); min 6% keeps tiny bars visible without spilling into labels.
    return nets.map((n) => {
      if (n === 0) return '0%';
      const pct = Math.round((n / max) * 50);
      return Math.max(pct, 6) + '%';
    });
  }

  sparklineMonthLabels(analysis: SavingsAnalysis): string[] {
    return analysis.monthlySnapshots.map((s) => MONTH_LETTERS[s.month] ?? '');
  }

  detailViewVisible = false;
  budget: Budget = {
    budgetId: null,
    category: { id: 0 } as Category,
    amount: 0,
    month: 0,
    year: 0,
  };
  actualAmount: number = 0;

  onRowClick(group: any) {
    this.vm$.pipe(take(1)).subscribe((vm) => {
      const foundBudget = vm.budgets.find((b: Budget) => b.category.id === group.category.id);
      if (foundBudget) this.budget = foundBudget;
      else
        this.budget = {
          budgetId: null,
          category: group.category,
          amount: 0,
          month: this.selectedMonth,
          year: this.selectedYear,
        };
      this.actualAmount = group.actualAmount;
      this.detailViewVisible = true;
    });
  }

  closeDetailView() {
    this.detailViewVisible = false;
  }

  fillMissingBudgets(missing: any[]) {
    for (const rt of missing) {
      const budget: Budget = {
        budgetId: null,
        category: rt.category || ({ id: rt.category_id } as Category),
        amount: rt.expectedAmount,
        month: this.selectedMonth,
        year: this.selectedYear,
      };
      this.budgetService.postBudget(budget).subscribe({
        next: () => this.refreshBudgets$.next(),
        error: (err) => console.error('Failed to auto-fill budget:', err),
      });
    }
  }
  onBudgetUpdated() {
    this.refreshBudgets$.next();
  }
}
