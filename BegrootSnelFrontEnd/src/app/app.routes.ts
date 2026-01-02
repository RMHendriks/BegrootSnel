import { Routes } from '@angular/router';
import { TransactionsPage } from './components/transactions-page/transactions-page';
import { Dashboard } from './components/dashboard/dashboard';

export const routes: Routes = [
    { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
    { path: 'dashboard', component: Dashboard },
    { path: 'transactions', component: TransactionsPage},
    ]
