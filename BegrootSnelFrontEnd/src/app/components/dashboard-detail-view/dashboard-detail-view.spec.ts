import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DashboardDetailView } from './dashboard-detail-view';

describe('DashboardDetailView', () => {
  let component: DashboardDetailView;
  let fixture: ComponentFixture<DashboardDetailView>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardDetailView]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DashboardDetailView);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
