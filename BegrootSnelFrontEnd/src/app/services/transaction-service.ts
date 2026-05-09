import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import { environment } from '../../environment/environment.development';
import { Category } from '../models/category';
import { Transaction } from '../models/transaction';

@Injectable({
  providedIn: 'root',
})
export class TransactionService {
  private http = inject(HttpClient);

  private baseUrl = environment.apiUrl;

  updateTransaction(transaction: Transaction): Observable<Transaction> {
    return this.putTransaction(transaction);
  }

  getTransactions(accountId?: number | null): Observable<Transaction[]> {
    const params = accountId ? `?accountId=${accountId}` : '';
    return this.http.get<Transaction[]>(`${this.baseUrl}/transactions${params}`);
  }

  putTransaction(transaction: Transaction): Observable<Transaction> {
    return this.http.put<Transaction>(
      `${this.baseUrl}/transactions/${transaction.id}`,
      transaction,
    );
  }

  intializeTransactions(): Observable<Transaction> {
    return this.http.get<Transaction>(`${this.baseUrl}/transactions/load`);
  }

  deleteTransaction(id: number): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(`${this.baseUrl}/transactions/${id}`);
  }

  deleteOrphanedTransactions(accountId?: number): Observable<{ deletedCount: number }> {
    const params = accountId ? `?accountId=${accountId}` : '';
    return this.http.delete<{ deletedCount: number }>(
      `${this.baseUrl}/transactions/orphaned${params}`,
    );
  }
}
