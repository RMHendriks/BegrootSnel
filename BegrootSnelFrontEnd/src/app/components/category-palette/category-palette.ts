import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, EventEmitter, Input, OnChanges, Output, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-category-palette',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './category-palette.html',
  styleUrl: './category-palette.scss',
})
export class CategoryPalette implements OnChanges, AfterViewInit {
  @Input() categories: any[] = [];
  @Input() context: any = null;
  @Output() select = new EventEmitter<any>();
  @Output() close = new EventEmitter<void>();

  @ViewChild('filterInput') filterInput!: ElementRef;

  searchQuery = '';
  selectedIndex: number = -1; // Houdt bij welk item highlighted is
  filteredCategories: any[] = [];

  ngOnChanges() {
    this.filteredCategories = this.categories;
    this.searchQuery = '';
  }

  ngAfterViewInit() {
    setTimeout(() => {
      this.filterInput.nativeElement.focus();
    }, 0);
  }

  filterResults() {
    const q = this.searchQuery.toLowerCase();
    this.filteredCategories = this.categories.filter(c =>
      c.name.toLowerCase().includes(q) || c.path.toLowerCase().includes(q)
      
    );
    this.selectedIndex = -1; // Reset selectie bij nieuw pallete
  }

  onKeyDown(event: KeyboardEvent) {
    if (this.filteredCategories.length === 0) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.selectedIndex = (this.selectedIndex + 1) % this.filteredCategories.length;
        this.scrollToActive();
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.selectedIndex = (this.selectedIndex - 1 + this.filteredCategories.length) % this.filteredCategories.length;
        this.scrollToActive();
        break;
      case 'Enter':
        event.preventDefault();
        this.select.emit(this.filteredCategories[this.selectedIndex]);
        break;
      case 'Escape':
        this.close.emit();
        break;
    }
  }

  private scrollToActive() {
    const activeElement = document.querySelector('.result-item.active');
    activeElement?.scrollIntoView({ block: 'nearest' });
  }
}

