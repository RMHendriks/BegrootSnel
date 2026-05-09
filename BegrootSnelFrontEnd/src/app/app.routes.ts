import { Routes } from '@angular/router';
import { TransactionsPage } from './components/transactions-page/transactions-page';
import { Dashboard } from './components/dashboard/dashboard';
import { CategoryPage } from './components/category-page/category-page';
import { AccountPage } from './components/account-page/account-page';
import { RecurringTransactionsPage } from './components/recurring-transactions-page/recurring-transactions-page';

export const routes: Routes = [
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
  { path: 'dashboard', component: Dashboard },
  { path: 'transactions', component: TransactionsPage },
  { path: 'categories', component: CategoryPage },
  { path: 'accounts', component: AccountPage },
  { path: 'recurring', component: RecurringTransactionsPage },
];
