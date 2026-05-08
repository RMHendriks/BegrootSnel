import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  CategoryService,
  CreateCategoryDto,
  UpdateCategoryDto,
} from '../../services/category-service';
import { Category } from '../../models/category';

@Component({
  selector: 'app-category-page',
  imports: [FormsModule],
  templateUrl: './category-page.html',
  styleUrl: './category-page.scss',
})
export class CategoryPage implements OnInit {
  roots: Category[] = [];
  selectedRoot: Category | null = null;
  selectedGroup: Category | null = null;

  // ── Edit state ──────────────────────────────────────────────────────────────
  editingId: number | null = null;
  editName = '';
  editColor = '';

  // ── Add state ───────────────────────────────────────────────────────────────
  addingAtLevel: 0 | 1 | 2 | null = null;
  newName = '';
  newColor = '';

  // ── Delete confirm state ────────────────────────────────────────────────────
  deletingId: number | null = null;

  readonly PRESET_COLORS = [
    '#ef4444',
    '#f97316',
    '#eab308',
    '#22c55e',
    '#14b8a6',
    '#3b82f6',
    '#8b5cf6',
    '#ec4899',
    '#78716c',
    '#1c1917',
  ];

  constructor(
    private categoryService: CategoryService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.loadCategories();
  }

  // ── Data ────────────────────────────────────────────────────────────────────

  loadCategories(): void {
    this.categoryService.getCategories().subscribe({
      next: (all) => {
        // getCategories() returns a flat list; level-0 items already carry
        // their full children tree via @JsonManagedReference on the backend.
        // Filter by parentId == null rather than level === 0: the `level` DB
        // column may not be set correctly when categories are seeded from JSON
        // (the seed file has no `level` field, so it defaults to 0 for all rows).
        this.roots = all.filter((c) => c.parentId == null);

        // Restore selections so the UI doesn't snap to empty after a reload.
        if (this.selectedRoot) {
          this.selectedRoot = this.roots.find((r) => r.id === this.selectedRoot!.id) ?? null;
          if (this.selectedRoot && this.selectedGroup) {
            this.selectedGroup =
              this.selectedRoot.children?.find((g) => g.id === this.selectedGroup!.id) ?? null;
          }
        }

        // Explicitly trigger change detection. The async pipe does this
        // automatically; with a plain subscribe() it can be missed during
        // the initial bootstrap cycle (Zone.js hasn't fully patched yet).
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Failed to load categories', err),
    });
  }

  get groups(): Category[] {
    return this.selectedRoot?.children ?? [];
  }

  get leaves(): Category[] {
    return this.selectedGroup?.children ?? [];
  }

  // ── Navigation ──────────────────────────────────────────────────────────────

  selectRoot(root: Category): void {
    if (this.editingId !== null) return;
    this.selectedRoot = root;
    this.selectedGroup = null;
    this.clearTransientState();
  }

  selectGroup(group: Category): void {
    if (this.editingId !== null) return;
    this.selectedGroup = group;
    this.clearTransientState();
  }

  private clearTransientState(): void {
    this.editingId = null;
    this.deletingId = null;
    this.addingAtLevel = null;
  }

  // ── Edit ────────────────────────────────────────────────────────────────────

  startEdit(cat: Category, event: Event): void {
    event.stopPropagation();
    this.deletingId = null;
    this.addingAtLevel = null;
    this.editingId = cat.id;
    this.editName = cat.name;
    this.editColor = cat.color ?? this.PRESET_COLORS[5];
  }

  saveEdit(): void {
    if (!this.editName.trim() || this.editingId === null) return;
    const dto: UpdateCategoryDto = { name: this.editName.trim(), color: this.editColor };
    this.categoryService.updateCategory(this.editingId, dto).subscribe({
      next: () => {
        this.editingId = null;
        this.loadCategories();
      },
      error: (err) => console.error('Failed to update category', err),
    });
  }

  cancelEdit(): void {
    this.editingId = null;
  }

  // ── Add ─────────────────────────────────────────────────────────────────────

  startAdd(level: 0 | 1 | 2): void {
    this.editingId = null;
    this.deletingId = null;
    this.addingAtLevel = level;
    this.newName = '';
    this.newColor = this.PRESET_COLORS[5]; // default blue
  }

  saveAdd(): void {
    if (!this.newName.trim() || this.addingAtLevel === null) return;

    const dto: CreateCategoryDto = {
      name: this.newName.trim(),
      level: this.addingAtLevel,
      assignable: this.addingAtLevel === 2,
    };
    if (this.addingAtLevel === 0) dto.color = this.newColor;
    if (this.addingAtLevel === 1) dto.parentId = this.selectedRoot!.id;
    if (this.addingAtLevel === 2) dto.parentId = this.selectedGroup!.id;

    this.categoryService.createCategory(dto).subscribe({
      next: () => {
        this.addingAtLevel = null;
        this.loadCategories();
      },
      error: (err) => console.error('Failed to create category', err),
    });
  }

  cancelAdd(): void {
    this.addingAtLevel = null;
  }

  // ── Delete ──────────────────────────────────────────────────────────────────

  requestDelete(cat: Category, event: Event): void {
    event.stopPropagation();
    this.editingId = null;
    this.addingAtLevel = null;
    // Toggle: clicking delete again on the same item cancels the confirmation.
    this.deletingId = this.deletingId === cat.id ? null : cat.id;
  }

  confirmDelete(cat: Category, event: Event): void {
    event.stopPropagation();
    this.categoryService.deleteCategory(cat.id).subscribe({
      next: () => {
        if (this.selectedRoot?.id === cat.id) {
          this.selectedRoot = null;
          this.selectedGroup = null;
        }
        if (this.selectedGroup?.id === cat.id) {
          this.selectedGroup = null;
        }
        this.deletingId = null;
        this.loadCategories();
      },
      error: (err) => console.error('Failed to delete category', err),
    });
  }

  cancelDelete(event: Event): void {
    event.stopPropagation();
    this.deletingId = null;
  }

  canDelete(cat: Category): boolean {
    return !cat.children || cat.children.length === 0;
  }

  // ── Color picker helpers ─────────────────────────────────────────────────────

  pickEditColor(color: string): void {
    this.editColor = color;
  }
  pickNewColor(color: string): void {
    this.newColor = color;
  }

  trackById(_: number, cat: Category): number {
    return cat.id;
  }
}
