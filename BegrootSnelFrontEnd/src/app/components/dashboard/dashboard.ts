import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BehaviorSubject, combineLatest, map, Observable, shareReplay, switchMap, tap } from 'rxjs';
import { ReportService } from '../../services/report-service';
import { CategoryService } from '../../services/category-service';
import { Report } from '../../models/report';
import { TransactionCategoryGroup } from '../../models/transaction-category-group';
import { Category } from '../../models/category';

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
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements OnInit {

  private reportService = inject(ReportService);
  private categoryService = inject(CategoryService);

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

  vm$ = combineLatest({
    report: this.report$,
    allCategories: this.allCategories$,
    roots: this.allCategories$.pipe(map(cats => cats.filter(c => c.level === 0)))
  }).pipe(
    map(({ report, allCategories, roots }) => {
      const categoryMap = new Map(allCategories.map(c => [c.id, c]));

      // Bereken Summary Data
      const allGroups = (report as any).transactionCategoryGroupDtoList || [];

      let totalIncome = 0;
      let totalBudgeted = 0;
      let totalSpent = 0;

      allGroups.forEach((g: TransactionCategoryGroup) => {
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

      return { report, roots, categoryMap, summary };
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
}