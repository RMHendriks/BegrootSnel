import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environment/environment.development';
import { RecurringTransaction, ScanResult } from '../models/recurring-transaction';
import { Transaction } from '../models/transaction';

@Injectable({
  providedIn: 'root',
})
export class RecurringTransactionService {
  private http = inject(HttpClient);
  private baseUrl = environment.apiUrl + '/recurring-transactions';

  getAll(status?: string): Observable<RecurringTransaction[]> {
    const params = status ? `?status=${status}` : '';
    return this.http.get<RecurringTransaction[]>(`${this.baseUrl}${params}`);
  }

  getById(id: number): Observable<RecurringTransaction> {
    return this.http.get<RecurringTransaction>(`${this.baseUrl}/${id}`);
  }

  scan(accountId?: number): Observable<ScanResult> {
    const params = accountId != null ? `?accountId=${accountId}` : '';
    return this.http.post<ScanResult>(`${this.baseUrl}/scan${params}`, {});
  }

  update(id: number, data: Partial<RecurringTransaction>): Observable<RecurringTransaction> {
    return this.http.put<RecurringTransaction>(`${this.baseUrl}/${id}`, data);
  }

  confirm(id: number): Observable<{ confirmed: boolean }> {
    return this.http.post<{ confirmed: boolean }>(`${this.baseUrl}/${id}/confirm`, {});
  }

  dismiss(id: number): Observable<{ dismissed: boolean }> {
    return this.http.post<{ dismissed: boolean }>(`${this.baseUrl}/${id}/dismiss`, {});
  }

  delete(id: number): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(`${this.baseUrl}/${id}`);
  }

  getMatchingTransactions(id: number): Observable<Transaction[]> {
    return this.http.get<Transaction[]>(`${this.baseUrl}/${id}/transactions`);
  }

  getMissingBudgets(year: number, month: number): Observable<RecurringTransaction[]> {
    return this.http.get<RecurringTransaction[]>(
      `${this.baseUrl}/missing-budgets/${year}/${month}`,
    );
  }
}
