import { CommonModule } from '@angular/common';
import { Component, Input, Output, EventEmitter, inject, OnInit } from '@angular/core';
import { TransactionSplit } from '../../models/transaction-split';
import { Transaction } from '../../models/transaction';
import { TransactionSplitService } from '../../services/transaction-split-service';
import { Budget } from '../../models/budget';
import { map, Observable } from 'rxjs';
import { SplitViewItem } from '../../models/split-view-item';
import { FormsModule } from '@angular/forms';

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
  @Output() newBudget = new EventEmitter<Budget>();


  private transactionSplitService = inject(TransactionSplitService);

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
    this.originalAmount = this.budget.amount; // Store original incase of cancel
    this.isEditingBudget = true;
    
    // Optional: Focus the input automatically (requires ViewChild, skipped for brevity)
  }

  saveBudget() {
    console.log('Saving budget:', this.budget);
    // Call your budgetService.save(this.budget) here
    this.isEditingBudget = false;
  }

  cancelEdit() {
    this.budget.amount = this.originalAmount; // Revert changes
    this.isEditingBudget = false;
  }

  toggleExpand(item: SplitViewItem) {
    item.isExpanded = !item.isExpanded;
  }
}
