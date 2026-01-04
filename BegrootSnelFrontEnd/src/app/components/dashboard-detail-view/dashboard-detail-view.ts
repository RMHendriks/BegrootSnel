import { CommonModule } from '@angular/common';
import { Component, Input, Output, EventEmitter, inject, OnInit } from '@angular/core';
import { TransactionSplit } from '../../models/transaction-split';
import { Transaction } from '../../models/transaction';
import { TransactionSplitService } from '../../services/transaction-split-service';
import { Budget } from '../../models/budget';
import { map, Observable } from 'rxjs';
import { SplitViewItem } from '../../models/split-view-item';
import { FormsModule } from '@angular/forms';
import { BudgetService } from '../../services/budget-service';

@Component({
  selector: 'app-dashboard-detail-view',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard-detail-view.html',
  styleUrl: './dashboard-detail-view.scss',
})
export class DashboardDetailView implements OnInit {

  @Input() budget: Budget = { budgetId: 0, category: { id: 0, name: '' }, amount: 0, month: 0, year: 0 } as Budget;
  @Input() actualAmount: number = 0;
  @Output() close = new EventEmitter<void>();
  @Output() savedBudget = new EventEmitter<void>();


  private transactionSplitService = inject(TransactionSplitService);
  private budgetService = inject(BudgetService);

  isEditingBudget = false;
  originalAmount = 0;

  vm$!: Observable<SplitViewItem[]>;

  ngOnInit() {
    if (this.budget) {
      this.vm$ = this.transactionSplitService.getSplitsByCategory(
        this.budget.year,
        this.budget.month,
        this.budget.category.id
      ).pipe(
        map(items => items.map(item => ({
          ...item,
          isExpandable: false
        })))
      );
    }
  }

  onAssignBudget() {
    this.originalAmount = this.budget.amount;
    this.isEditingBudget = true;
    
  }

  saveBudget() {
    console.log('Saving budget:', this.budget);
    this.isEditingBudget = false;
    this.savedBudget.emit();
    if (!this.budget.budgetId) {
      this.budgetService.postBudget(this.budget).subscribe({
        next: (updatedBudget) => {
          console.log('Budget saved successfully:', updatedBudget);
        }
      });
    }
    else {
      this.budgetService.putBudget(this.budget).subscribe({
        next: (updatedBudget) => {
          console.log('Budget updated successfully:', updatedBudget);
        }
      });
    }
  }

  cancelEdit() {
    this.budget.amount = this.originalAmount;
    this.isEditingBudget = false;
  }

  toggleExpand(item: SplitViewItem) {
    item.isExpanded = !item.isExpanded;
  }
}
