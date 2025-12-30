import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TransactionSplitManager } from '../transaction-split-manager/transaction-split-manager';
import { TransactionView } from './../../models/transaction-view';

@Component({
  selector: 'app-transaction-card',
  standalone: true,
  imports: [CommonModule, TransactionSplitManager],
  templateUrl: './transaction-card.html',
  styleUrl: './transaction-card.scss',
})
export class TransactionCard {
  @Input() transaction!: TransactionView;
  @Output() openPalette = new EventEmitter<{ t: TransactionView, idx: number }>();

  isExpanded = false;

  onRequestCategory(index: number) {
    this.openPalette.emit({ t: this.transaction, idx: index });
  }

  getCardBackground(): string {
    const t = this.transaction;
    const baseBackground = '#ffffff';

    if (!t.splits || t.splits.length === 0) {
      return `linear-gradient(to bottom, #ccc, #ccc) no-repeat left top / 6px 100%, ${baseBackground}`;
    }

    const step = 100 / t.splits.length;
    const stops = t.splits.map((split, index) => {
      const color = split.category?.color || '#e2e8f0';
      const start = index * step;
      const end = (index + 1) * step;
      return `${color} ${start}% ${end}%`;
    }).join(', ');

    return `linear-gradient(to bottom, ${stops}) no-repeat left top / 6px 100%, ${baseBackground}`;
  }
}
