import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TransactionCard } from './transaction-card';

describe('TransactionCard', () => {
  let component: TransactionCard;
  let fixture: ComponentFixture<TransactionCard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TransactionCard]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TransactionCard);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
