import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BehaviorSubject, combineLatest, map, Observable, of, shareReplay, switchMap, take, tap } from 'rxjs';
import { ReportService } from '../../services/report-service';
import { CategoryService } from '../../services/category-service';
import { Report } from '../../models/report';
import { TransactionCategoryGroup } from '../../models/transaction-category-group';
import { Category } from '../../models/category';
import { DashboardDetailView } from '../dashboard-detail-view/dashboard-detail-view';
import { BudgetService } from '../../services/budget-service';
import { Budget } from '../../models/budget';

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

  // Filters state
  filterMode: 'month' | 'range' = 'month';
  selectedYear = 2025; // new Date().getFullYear();
  selectedMonth = 12; // new Date().getMonth() + 1;
  customStartDate = '';
  customEndDate = '';

  isSummaryExpanded = false; // Voor mobiele toggle

  availableYears = [2025, 2026];
  months = [
    { value: 1, label: 'Januari' }, { value: 2, label: 'Februari' },
    { value: 3, label: 'Maart' }, { value: 4, label: 'April' },
    { value: 5, label: 'Mei' }, { value: 6, label: 'Juni' },
    { value: 7, label: 'Juli' }, { value: 8, label: 'Augustus' },
    { value: 9, label: 'September' }, { value: 10, label: 'Oktober' },
    { value: 11, label: 'November' }, { value: 12, label: 'December' }
  ];

  private params$ = new BehaviorSubject<ReportParams>({
    year: this.selectedYear,
    month: this.selectedMonth
  });

  private allCategories$ = this.categoryService.getCategories().pipe(
    shareReplay(1)
  );

  report$: Observable<Report> = this.params$.pipe(
    switchMap(p => {
      if (p.start && p.end) {
        return this.reportService.getReport(p.start, p.end);
      }
      return this.reportService.getReportByYearAndMonth(p.year!, p.month!);
    }),
    shareReplay(1)
  );

  private refreshBudgets$ = new BehaviorSubject<void>(undefined);

  budgets$ = combineLatest([this.params$, this.refreshBudgets$]).pipe(
    switchMap(([p, _]) => {
      if (p.year && p.month) {
        return this.budgetService.getBudgets(p.year, p.month);
      }
      return of([]);
    }),
    shareReplay(1)
  );

  vm$ = combineLatest({
    report: this.report$,
    allCategories: this.allCategories$,
    budgets: this.budgets$, // Bevat de verse data na je .next()
    roots: this.allCategories$.pipe(map(cats => cats.filter(c => c.level === 0)))
  }).pipe(
    map(({ report, allCategories, budgets, roots }) => {
      const categoryMap = new Map(allCategories.map(c => [c.id, c]));

      // 1. Maak een Map van de NIEUWE budgets voor snelle lookup
      const budgetMap = new Map(budgets.map(b => [b.category.id, b]));

      const allGroups = (report as any).transactionCategoryGroupDtoList || [];

      let totalIncome = 0;
      let totalBudgeted = 0;
      let totalSpent = 0;

      // 2. Loop door de groepen heen
      allGroups.forEach((g: TransactionCategoryGroup) => {

        const freshBudget = budgetMap.get(g.category.id);

        if (freshBudget) {
          // Overschrijf de (oude) waarde uit het report met de nieuwe waarde
          g.budgetedAmount = freshBudget.amount;
        } else {
          // Geen budget gevonden in de DB? Dan is het 0.
          g.budgetedAmount = 0;
        }

        // 3. Herbereken de totalen met de BIJGEWERKTE g.budgetedAmount
        const root = this.findRootForCategory(g.category.id, categoryMap);
        if (root?.name.toUpperCase() === 'INKOMSTEN') {
          totalIncome += g.actualAmount;
        } else if (root?.name.toUpperCase() === 'UITGAVEN') {
          totalSpent += g.actualAmount;
          totalBudgeted += g.budgetedAmount;
        }
      });

      const summary: SummaryData = {
        totalIncome,
        totalBudgeted,
        totalSpent,
        difference: totalIncome - totalSpent
      };

      return { report, roots, categoryMap, summary, budgets };
    })
  );

  ngOnInit(): void { }


  setFilterMode(mode: 'month' | 'range') {
    this.filterMode = mode;
  }

  onMonthYearChange() {
    this.params$.next({ year: this.selectedYear, month: this.selectedMonth });
  }

  onRangeChange() {
    if (this.customStartDate && this.customEndDate) {
      this.params$.next({ start: this.customStartDate, end: this.customEndDate });
    }
  }

  incrementMonth() {
    if (this.selectedYear >= Math.max(...this.availableYears) && this.selectedMonth === 12) return;
    if (this.selectedMonth === 12) {
      this.selectedMonth = 1;
      this.selectedYear++;
    } else {
      this.selectedMonth++;
    }
    this.onMonthYearChange();
  }

  decrementMonth() {
    if (this.selectedYear <= Math.min(...this.availableYears) && this.selectedMonth === 1) return;
    if (this.selectedMonth === 1) {
      this.selectedMonth = 12;
      this.selectedYear--;
    } else {
      this.selectedMonth--;
    }
    this.onMonthYearChange();
  }

  private getAllChildIds(category: Category): number[] {
    let ids: number[] = [Number(category.id)];

    if (category.children && Array.isArray(category.children)) {
      category.children.forEach(child => {
        ids = [...ids, ...this.getAllChildIds(child)];
      });
    }
    return ids;
  }

  getGroupsByRoot(report: Report, rootCategory: Category, categoryMap: Map<number, Category>): TransactionCategoryGroup[] {
    const allGroups = (report as any).transactionCategoryGroupDtoList || [];
    if (!allGroups.length || !rootCategory || !categoryMap.size) return [];

    return allGroups.filter((group: TransactionCategoryGroup) => {
      let current = group.category;
      if (!current) return false;

      // Loop omhoog via parentId tot we bij de root (level 0) zijn
      let safetyBreak = 0;
      while (current && current.level !== 0 && safetyBreak < 10) {
        const parentId = (current as any).parentId; // Gebruik de nieuwe property
        if (!parentId) break;
        current = categoryMap.get(parentId)!;
        safetyBreak++;
      }

      // Check of de gevonden root overeenkomt met de sectie die we nu renderen
      return current && current.id === rootCategory.id;
    });
  }

  calculateRootTotal(groups: TransactionCategoryGroup[]): number {
    return groups.reduce((sum, g) => sum + g.actualAmount, 0);
  }

  // In de Dashboard class:
  getLevel1Groups(report: Report, root: Category, categoryMap: Map<number, Category>): GroupedCategory[] {
    const groups = this.getGroupsByRoot(report, root, categoryMap);
    const groupedMap = new Map<number, GroupedCategory>();

    groups.forEach(g => {
      // Zoek de Level 1 ouder van deze Level 2 categorie
      let level1: Category | undefined;

      // We kijken naar de parentId van de categorie in de groep
      const catFromMap = categoryMap.get(g.category.id);
      if (catFromMap && catFromMap.parentId) {
        level1 = categoryMap.get(catFromMap.parentId);
      }

      if (level1) {
        if (!groupedMap.has(level1.id)) {
          groupedMap.set(level1.id, { level1, groups: [], subTotal: 0 });
        }
        const entry = groupedMap.get(level1.id)!;
        entry.groups.push(g);
        entry.subTotal += g.actualAmount;
      }
    });

    return Array.from(groupedMap.values());
  }

  // Helper om root te vinden zonder dubbele code
  private findRootForCategory(categoryId: number, categoryMap: Map<number, Category>): Category | undefined {
    let current = categoryMap.get(categoryId);
    let safety = 0;
    while (current && current.level !== 0 && safety < 10) {
      const parentId = (current as any).parentId;
      if (!parentId) break;
      current = categoryMap.get(parentId);
      safety++;
    }
    return current;
  }

  calculateRootTotalByName(vm: any, rootName: string): number {
    const root = vm.roots.find((r: any) => r.name.toUpperCase() === rootName.toUpperCase());
    if (!root) return 0;

    const groups = this.getGroupsByRoot(vm.report, root, vm.categoryMap);
    return this.calculateRootTotal(groups);
  }


  // --- Detail View State ---
  detailViewVisible = false;

  // --- Data for the Detail View ---
  budget: Budget = {
    budgetId: null,
    category: { id: 0 } as Category,
    amount: 0,
    month: 0,
    year: 0
  };

  actualAmount: number = 0;

  onRowClick(group: any) {
    // Haal de huidige data uit de VM snapshot (take 1)
    this.vm$.pipe(take(1)).subscribe(vm => {

      // Zoek of er al een budget bestaat in de lijst die we al hebben
      const foundBudget = vm.budgets.find((b: Budget) => b.category.id === group.category.id);

      if (foundBudget) {
        // Gebruik het bestaande object uit de lijst
        this.budget = foundBudget;
      } else {
        // Maak een nieuw object aan dat voldoet aan jouw Interface
        this.budget = {
          budgetId: null,
          category: group.category,
          amount: 0,
          month: this.selectedMonth,
          year: this.selectedYear
        };
      }

      this.actualAmount = group.actualAmount;
      this.detailViewVisible = true;
    });
  }

  closeDetailView() {
    this.detailViewVisible = false;
  }

  onBudgetUpdated() {
    this.refreshBudgets$.next();
  }

}