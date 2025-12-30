import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TransactionSplitManager } from './transaction-split-manager';

describe('TransactionSplitManager', () => {
  let component: TransactionSplitManager;
  let fixture: ComponentFixture<TransactionSplitManager>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TransactionSplitManager]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TransactionSplitManager);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
