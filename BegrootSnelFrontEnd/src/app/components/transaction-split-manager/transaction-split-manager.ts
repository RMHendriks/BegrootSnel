import { Component, EventEmitter, Input, Output } from '@angular/core';
import { TransactionView } from '../../models/transaction-view';
import { TransactionSplit } from '../../models/transaction-split';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TransactionService } from '../../services/transaction-service';

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

  private originalSplitsSnapshot: TransactionSplit[] = [];
  private wasAlreadySplit = false;
  flexSplitIndex = -1;

  constructor(private transactionService: TransactionService) {}

  hasCategory(): boolean {
    return (
      (this.transaction.splits?.length ?? 0) > 0 && this.transaction.splits[0].category !== null
    );
  }

  isDisplayMode(): boolean {
    return !this.transaction.isEditingSplits && this.hasCategory();
  }

  isUnsplitMode(): boolean {
    return !this.transaction.isEditingSplits && !this.hasCategory();
  }

  startEditing(): void {
    this.wasAlreadySplit = this.hasCategory();
    this.originalSplitsSnapshot = JSON.parse(JSON.stringify(this.transaction.splits ?? []));
    this.transaction.isEditingSplits = true;

    if (!this.wasAlreadySplit) {
      const half = this.round(this.transaction.mutation / 2);
      const remainder = this.round(this.transaction.mutation - half);
      const pct0 =
        this.transaction.mutation !== 0 ? this.round((half / this.transaction.mutation) * 100) : 50;
      const pct1 =
        this.transaction.mutation !== 0
          ? this.round((remainder / this.transaction.mutation) * 100)
          : 50;
      this.transaction.splits = [
        this.createSplit(null, half, pct0),
        this.createSplit(null, remainder, pct1),
      ];
      this.flexSplitIndex = -1;
    } else {
      this.flexSplitIndex =
        (this.transaction.splits?.length ?? 0) >= 3
          ? (this.transaction.splits?.length ?? 0) - 1
          : -1;
    }
  }

  saveSplits(): void {
    const valid = (this.transaction.splits ?? []).filter(
      (s) => s.category !== null && Math.abs(s.amount ?? 0) > 0.001,
    );

    if (valid.length === 0) {
      this.transaction.splits = [];
    } else if (valid.length === 1) {
      valid[0].amount = this.transaction.mutation;
      valid[0].percentage = 100;
      this.transaction.splits = valid;
    } else {
      const sumOthers = valid.slice(0, -1).reduce((sum, s) => sum + (s.amount ?? 0), 0);
      const last = valid[valid.length - 1];
      last.amount = this.round(this.transaction.mutation - sumOthers);
      last.percentage =
        this.transaction.mutation !== 0
          ? this.round((last.amount / this.transaction.mutation) * 100)
          : 0;
      this.transaction.splits = valid;
    }

    this.transaction.isEditingSplits = false;
    this.transactionService.updateTransaction(this.transaction).subscribe();
  }

  cancelEditing(): void {
    if (this.wasAlreadySplit) {
      this.transaction.splits = JSON.parse(JSON.stringify(this.originalSplitsSnapshot));
    } else {
      this.transaction.splits = [];
    }
    this.transaction.isEditingSplits = false;
  }

  getDisplayAmount(index: number): number {
    return Math.abs(this.transaction.splits?.[index]?.amount ?? 0);
  }

  onAmountChange(index: number, displayValue: number): void {
    const mutation = this.transaction.mutation;
    const sign = mutation >= 0 ? 1 : -1;
    const rawSigned = (displayValue ?? 0) * sign;
    const splits = this.transaction.splits;
    if (!splits) return;
    splits[index].amount = rawSigned;
    this.updateFromAmount(index);
  }

  getDisplayPercentage(index: number): number {
    return this.round(this.transaction.splits?.[index]?.percentage ?? 0);
  }

  onPercentageChange(index: number, displayValue: number): void {
    const splits = this.transaction.splits;
    if (!splits) return;
    splits[index].percentage = displayValue ?? 0;
    this.updateFromPercentage(index);
  }

  addSplit(): void {
    const splits = this.transaction.splits;
    if (!splits) return;

    if (splits.length === 0) {
      const half = this.round(this.transaction.mutation / 2);
      splits.push(this.createSplit(null, half, 50));
      splits.push(this.createSplit(null, this.round(this.transaction.mutation - half), 50));
      this.flexSplitIndex = -1;
      return;
    }

    if (splits.length === 1) {
      const existing = splits[0];
      const remainder = this.round(this.transaction.mutation - (existing.amount ?? 0));
      const remainderPct =
        this.transaction.mutation !== 0
          ? this.round((remainder / this.transaction.mutation) * 100)
          : 0;
      splits.push(this.createSplit(null, remainder, remainderPct));
      this.flexSplitIndex = -1;
      return;
    }

    if (splits.length === 2) {
      splits.push(this.createSplit(null, 0, 0));
      this.flexSplitIndex = 2;
      this.recalculateFlex();
      return;
    }

    splits.push(this.createSplit(null, 0, 0));
    this.flexSplitIndex = splits.length - 1;
    this.recalculateFlex();
  }

  removeSplit(index: number): void {
    const splits = this.transaction.splits;
    if (!splits || splits.length === 0) return;

    if (splits.length === 1) {
      this.transaction.splits = [];
      this.transaction.isEditingSplits = false;
      return;
    }

    if (splits.length === 2) {
      splits.splice(index, 1);
      splits[0].amount = this.transaction.mutation;
      splits[0].percentage = 100;
      this.flexSplitIndex = -1;
      return;
    }

    if (splits.length === 3) {
      splits.splice(index, 1);
      this.flexSplitIndex = -1;
      if (this.transaction.mutation !== 0) {
        splits[0].amount = this.transaction.mutation / 2;
        splits[0].percentage = 50;
        splits[1].amount = this.transaction.mutation - splits[0].amount;
        splits[1].percentage = 50;
      }
      return;
    }

    if (index === this.flexSplitIndex) {
      splits.splice(index, 1);
      this.flexSplitIndex = splits.length - 1;
    } else if (index < this.flexSplitIndex) {
      splits.splice(index, 1);
      this.flexSplitIndex--;
    } else {
      splits.splice(index, 1);
    }
    this.recalculateFlex();
  }

  isFlexSplit(index: number): boolean {
    return this.flexSplitIndex >= 0 && index === this.flexSplitIndex;
  }

  hasFlexSystem(): boolean {
    return (this.transaction.splits?.length ?? 0) >= 3;
  }

  setFlexSplit(index: number): void {
    if (index === this.flexSplitIndex || !this.hasFlexSystem()) return;
    this.flexSplitIndex = index;
    this.recalculateFlex();
  }

  private recalculateFlex(): void {
    const splits = this.transaction.splits;
    if (this.flexSplitIndex < 0 || splits.length < 3) return;

    const mutation = this.transaction.mutation;
    const editableSum = splits
      .filter((_, i) => i !== this.flexSplitIndex)
      .reduce((sum, s) => sum + (s.amount ?? 0), 0);

    const flexAmount = this.round(mutation - editableSum);
    splits[this.flexSplitIndex].amount = flexAmount;
    splits[this.flexSplitIndex].percentage =
      mutation !== 0 ? this.round((flexAmount / mutation) * 100) : 0;
    if (Math.abs(flexAmount) < 0.001) {
      splits[this.flexSplitIndex].percentage = 0;
    }
  }

  updateFromAmount(index: number): void {
    const splits = this.transaction.splits;
    const split = splits[index];
    const mutation = this.transaction.mutation;
    if (mutation === 0) return;

    split.amount = this.clampAmount(split.amount, mutation);
    if (Math.abs(split.amount) < 0.001) split.percentage = 0;

    if (splits.length === 2) {
      const other = splits[index === 0 ? 1 : 0];
      other.amount = this.round(mutation - split.amount);
      if (Math.abs(split.amount) >= 0.001) {
        split.percentage = this.round((split.amount / mutation) * 100);
      }
      other.percentage = this.round(100 - split.percentage);
      if (Math.abs(other.amount) < 0.001) other.percentage = 0;
    } else {
      this.balanceEditableSplits(index);
      if (Math.abs(split.amount) >= 0.001) {
        split.percentage = this.round((split.amount / mutation) * 100);
      }
      this.recalculateFlex();
    }
  }

  updateFromPercentage(index: number): void {
    const splits = this.transaction.splits;
    const split = splits[index];
    const mutation = this.transaction.mutation;
    if (mutation === 0) return;

    split.percentage = this.round(Math.min(100, Math.max(0, split.percentage ?? 0)));
    split.amount = this.round((mutation * split.percentage) / 100);
    if (Math.abs(split.amount) < 0.001) split.percentage = 0;

    if (splits.length === 2) {
      const other = splits[index === 0 ? 1 : 0];
      other.percentage = this.round(100 - split.percentage);
      other.amount = this.round(mutation - split.amount);
      if (Math.abs(other.amount) < 0.001) other.percentage = 0;
    } else {
      this.balanceEditableSplits(index);
      if (Math.abs(split.amount) >= 0.001) {
        split.percentage = this.round((split.amount / mutation) * 100);
      }
      this.recalculateFlex();
    }
  }

  private balanceEditableSplits(editedIndex: number): void {
    const splits = this.transaction.splits;
    const mutation = this.transaction.mutation;

    const otherIndices = splits
      .map((_, i) => i)
      .filter((i) => i !== editedIndex && i !== this.flexSplitIndex);

    const otherSum = otherIndices.reduce((sum, i) => sum + splits[i].amount, 0);
    let flexNeeded = mutation - splits[editedIndex].amount - otherSum;

    if ((mutation > 0 && flexNeeded >= 0) || (mutation < 0 && flexNeeded <= 0)) return;

    let overflow = mutation > 0 ? -flexNeeded : flexNeeded;

    for (const i of otherIndices) {
      if (overflow <= 0.001) break;
      const available =
        mutation > 0 ? Math.max(0, splits[i].amount) : Math.min(0, splits[i].amount);
      const take = Math.min(Math.abs(available), overflow);
      if (take > 0) {
        splits[i].amount = this.round(available - (mutation > 0 ? take : -take));
        // Keep percentage in sync with the modified amount.
        splits[i].percentage = mutation !== 0 ? this.round((splits[i].amount / mutation) * 100) : 0;
        if (Math.abs(splits[i].amount) < 0.001) splits[i].percentage = 0;
        overflow = this.round(overflow - take);
      }
    }

    if (overflow > 0.001) {
      splits[editedIndex].amount = this.round(
        mutation > 0
          ? Math.max(0, splits[editedIndex].amount - overflow)
          : Math.min(0, splits[editedIndex].amount + overflow),
      );
    }
  }

  getSplitTotal(): number {
    return this.round((this.transaction.splits ?? []).reduce((sum, s) => sum + (s.amount ?? 0), 0));
  }

  isTotalBalanced(): boolean {
    return Math.abs(this.getSplitTotal() - this.transaction.mutation) < 0.01;
  }

  getBalanceLabel(): string {
    const diff = this.round(this.getSplitTotal() - this.transaction.mutation);
    if (Math.abs(diff) < 0.01) return 'OK';
    const isTooMuch = diff * this.transaction.mutation > 0;
    return isTooMuch
      ? `€${Math.abs(diff).toFixed(2)} te veel`
      : `€${Math.abs(diff).toFixed(2)} te weinig`;
  }

  canRemove(): boolean {
    return (this.transaction.splits?.length ?? 0) >= 1;
  }

  private createSplit(category: any, amount: number, percentage: number): TransactionSplit {
    return { category, amount, percentage, usePercentage: false, parentId: this.transaction.id };
  }

  private round(n: number): number {
    return Math.round(n * 100) / 100;
  }

  private clampAmount(amount: number, mutation: number): number {
    if (mutation > 0) return Math.min(mutation, Math.max(0, amount ?? 0));
    return Math.min(0, Math.max(mutation, amount ?? 0));
  }
}
