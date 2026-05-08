import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TransactionSplitManager } from './transaction-split-manager';
import { TransactionService } from '../../services/transaction-service';
import { of } from 'rxjs';
import { TransactionView } from '../../models/transaction-view';
import { TransactionSplit } from '../../models/transaction-split';

describe('TransactionSplitManager', () => {
  let component: TransactionSplitManager;
  let fixture: ComponentFixture<TransactionSplitManager>;
  let mockService: { updateTransaction: ReturnType<typeof vi.fn> };

  function makeTransaction(overrides: Partial<TransactionView> = {}): TransactionView {
    return {
      id: 1,
      account: {
        id: 1,
        accountNumber: 'NL00TEST',
        name: 'Test Account',
        type: 'PAYMENT',
        active: true,
      },
      counterpartyAccountNumber: undefined,
      counterpartyName: undefined,
      internalTransfer: false,
      oldBalance: 1000,
      newBalance: 1250,
      transactionDate: '2025-01-15',
      prettyTitle: 'Test',
      description: '',
      currency: 'EUR',
      mutation: 250,
      splits: [],
      isExpanded: false,
      isEditingSplits: false,
      ...overrides,
    };
  }

  function makeSplit(cat: any = null, amount = 0, pct = 0): TransactionSplit {
    return { category: cat, amount, percentage: pct, usePercentage: false, parentId: 1 };
  }

  beforeEach(async () => {
    mockService = { updateTransaction: vi.fn().mockReturnValue(of({} as any)) };
    await TestBed.configureTestingModule({
      imports: [TransactionSplitManager],
      providers: [{ provide: TransactionService, useValue: mockService }],
    }).compileComponents();
    fixture = TestBed.createComponent(TransactionSplitManager);
    component = fixture.componentInstance;
  });

  describe('state detection', () => {
    it('isUnsplitMode when no splits', () => {
      component.transaction = makeTransaction({ splits: [] });
      expect(component.isUnsplitMode()).toBeTruthy();
    });
  });

  describe('flex split system', () => {
    it('hasFlexSystem false for 2, true for 3+', () => {
      component.transaction = makeTransaction({
        splits: [makeSplit({ id: 1 }, 100, 50), makeSplit({ id: 2 }, 100, 50)],
      });
      expect(component.hasFlexSystem()).toBeFalsy();
      component.transaction = makeTransaction({
        splits: [
          makeSplit({ id: 1 }, 80, 33),
          makeSplit({ id: 2 }, 80, 33),
          makeSplit({ id: 3 }, 80, 34),
        ],
      });
      expect(component.hasFlexSystem()).toBeTruthy();
    });
  });

  describe('addSplit', () => {
    it('2->3 appends and becomes flex', () => {
      component.transaction = makeTransaction({
        isEditingSplits: true,
        mutation: 300,
        splits: [
          makeSplit({ id: 1, name: 'A' }, 150, 50),
          makeSplit({ id: 2, name: 'B' }, 150, 50),
        ],
      });
      component.flexSplitIndex = -1;
      component.addSplit();
      expect(component.transaction.splits.length).toBe(3);
      expect(component.flexSplitIndex).toBe(2);
    });
  });

  describe('removeSplit', () => {
    it('1->0 clears and exits editing', () => {
      component.transaction = makeTransaction({
        isEditingSplits: true,
        mutation: 200,
        splits: [makeSplit({ id: 1, name: 'A' }, 200, 100)],
      });
      component.removeSplit(0);
      expect(component.transaction.splits.length).toBe(0);
      expect(component.transaction.isEditingSplits).toBeFalsy();
    });

    it('2->1 remaining gets full amount', () => {
      component.transaction = makeTransaction({
        mutation: 200,
        splits: [
          makeSplit({ id: 1, name: 'A' }, 100, 50),
          makeSplit({ id: 2, name: 'B' }, 100, 50),
        ],
      });
      component.removeSplit(0);
      expect(component.transaction.splits.length).toBe(1);
      expect(component.transaction.splits[0].amount).toBe(200);
    });
  });

  describe('updateFromAmount', () => {
    it('2-split complementary', () => {
      component.transaction = makeTransaction({
        mutation: 200,
        splits: [makeSplit({ id: 1 }, 100, 50), makeSplit({ id: 2 }, 100, 50)],
      });
      component.transaction.splits[0].amount = 150;
      component.updateFromAmount(0);
      expect(component.transaction.splits[1].amount).toBe(50);
    });
  });

  describe('validation', () => {
    it('getBalanceLabel OK when balanced', () => {
      component.transaction = makeTransaction({
        mutation: 100,
        splits: [makeSplit({ id: 1 }, 50, 50), makeSplit({ id: 2 }, 50, 50)],
      });
      expect(component.getBalanceLabel()).toBe('OK');
    });
  });

  describe('display value conversion', () => {
    it('getDisplayAmount returns absolute', () => {
      component.transaction = makeTransaction({
        mutation: -100,
        splits: [makeSplit({ id: 1 }, -60, 60)],
      });
      expect(component.getDisplayAmount(0)).toBe(60);
    });

    it('onAmountChange converts to signed', () => {
      component.transaction = makeTransaction({
        mutation: -100,
        splits: [makeSplit({ id: 1 }, -50, 50), makeSplit({ id: 2 }, -50, 50)],
      });
      component.onAmountChange(0, 75);
      expect(component.transaction.splits[0].amount).toBe(-75);
      expect(component.transaction.splits[1].amount).toBe(-25);
    });
  });

  describe('flex overflow prevention', () => {
    it('reduces other splits before clamping edited split', () => {
      component.transaction = makeTransaction({
        mutation: 100,
        splits: [
          makeSplit({ id: 1, name: 'A' }, 40, 40),
          makeSplit({ id: 2, name: 'B' }, 30, 30),
          makeSplit({ id: 3, name: 'C' }, 30, 30),
        ],
      });
      component.flexSplitIndex = 2;
      // Try to set A to 120 — B gives up its 30, A lands at 100.
      component.transaction.splits[0].amount = 120;
      component.updateFromAmount(0);
      expect(component.transaction.splits[0].amount).toBe(100);
      expect(component.transaction.splits[1].amount).toBe(0);
      expect(component.transaction.splits[2].amount).toBe(0);
    });
  });

  describe('canRemove', () => {
    it('returns true for 1+ splits, false for 0', () => {
      component.transaction = makeTransaction({ splits: [makeSplit({ id: 1 }, 100, 100)] });
      expect(component.canRemove()).toBeTruthy();
      component.transaction = makeTransaction({ splits: [] });
      expect(component.canRemove()).toBeFalsy();
    });
  });
});
