import { Component, EventEmitter, Input, Output } from '@angular/core';
import { TransactionView } from '../../models/transaction-view';
import { TransactionSplit } from '../../models/transaction-split';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TransactionService } from '../../services/transaction-service';
import { Transaction } from '../../models/transaction';

@Component({
  selector: 'app-transaction-split-manager',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './transaction-split-manager.html',
  styleUrl: './transaction-split-manager.scss',
})
export class TransactionSplitManager {
  @Input() transaction!: TransactionView;
  @Output() requestCategory = new EventEmitter<number>();

  constructor(private transactionService: TransactionService) { }

  hasCategory(): boolean {
    return this.transaction.splits?.length > 0 && this.transaction.splits[0].category !== null;
  }

  startSplitting() {
    this.transaction.isEditingSplits = true;
    this.addSplit();
  }

  addSplit() {
    const t = this.transaction;
    if (!t.splits) t.splits = [];

    if (t.splits.length === 0) {
      const firstAmount = Number((t.mutation / 2).toFixed(2));
      t.splits.push({ category: null, amount: firstAmount, percentage: 50, usePercentage: false });
      t.splits.push({ category: null, amount: Number((t.mutation - firstAmount).toFixed(2)), percentage: 50, usePercentage: false });
    } else {
      const currentTotal = t.splits.reduce((sum, s) => sum + s.amount, 0);
      const remaining = Number((t.mutation - currentTotal).toFixed(2));
      t.splits.push({
        category: null,
        amount: remaining,
        percentage: t.mutation !== 0 ? Number(((remaining / t.mutation) * 100).toFixed(2)) : 0,
        usePercentage: false
      });
    }
  }

  updateFromAmount(index: number) {
    const t = this.transaction;
    const split = t.splits[index];
    split.percentage = (split.amount / t.mutation) * 100;

    if (t.splits.length === 2) {
      const otherIndex = index === 0 ? 1 : 0;
      t.splits[otherIndex].amount = t.mutation - split.amount;
      t.splits[otherIndex].percentage = 100 - split.percentage;
    }
  }

  updateFromPercentage(index: number) {
    const t = this.transaction;
    const split = t.splits[index];
    split.amount = (t.mutation * split.percentage) / 100;

    if (t.splits.length === 2) {
      const otherIndex = index === 0 ? 1 : 0;
      t.splits[otherIndex].percentage = 100 - split.percentage;
      t.splits[otherIndex].amount = t.mutation - split.amount;
    }
  }

  toggleSplitMode(split: TransactionSplit) {
    split.usePercentage = !split.usePercentage;
  }

  saveSplit() {
    this.transaction.isEditingSplits = false;
    // Verwijder splits zonder categorie
    for (let i = this.transaction.splits.length - 1; i > 0; i--) {
      if (!this.transaction.splits[i].category) {
        this.transaction.splits.splice(i, 1);
      }
    }
    this.transactionService.updateTransaction(this.transaction).subscribe();
  }

  removeSplit(index: number) {
    const t = this.transaction;
    t.splits.splice(index, 1);
    if (t.splits.length === 1) {
      t.splits[0].amount = t.mutation;
      t.splits[0].percentage = 100;
    }
  }

  cancelSplitting() {
    if (confirm('Weet je zeker dat je de splits wilt verwijderen?')) {
      this.transaction.splits = [];
      // Herstel de basis staat (1 lege split) om errors te voorkomen
      this.transaction.splits = [{ category: null, amount: this.transaction.mutation, percentage: 100, usePercentage: false }];
      this.transaction.isEditingSplits = false;
    }
  }
}
