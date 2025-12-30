import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CategoryPalette } from './category-palette';

describe('CategoryPalette', () => {
  let component: CategoryPalette;
  let fixture: ComponentFixture<CategoryPalette>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CategoryPalette]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CategoryPalette);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
