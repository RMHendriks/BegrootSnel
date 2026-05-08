import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environment/environment.development';
import { BankAccount } from '../models/bank-account';
import { SavingsAnalysis } from '../models/savings-analysis';

// ── Service ───────────────────────────────────────────────────────────────────
@Injectable({ providedIn: 'root' })
export class BankAccountService {
  private http = inject(HttpClient);
  private baseUrl = environment.apiUrl;

  getAll(balanceDate?: string): Observable<BankAccount[]> {
    let params = new HttpParams();
    if (balanceDate) params = params.set('balanceDate', balanceDate);
    return this.http.get<BankAccount[]>(`${this.baseUrl}/accounts`, { params });
  }

  getActive(balanceDate?: string): Observable<BankAccount[]> {
    let params = new HttpParams();
    if (balanceDate) params = params.set('balanceDate', balanceDate);
    return this.http.get<BankAccount[]>(`${this.baseUrl}/accounts/active`, { params });
  }

  getSavingsAnalysis(
    accountId: number,
    months: number = 6,
    year?: number,
    month?: number,
  ): Observable<SavingsAnalysis> {
    let params = new HttpParams().set('months', months);
    if (year != null) params = params.set('year', year);
    if (month != null) params = params.set('month', month);
    return this.http.get<SavingsAnalysis>(
      `${this.baseUrl}/accounts/${accountId}/savings-analysis`,
      { params },
    );
  }

  create(account: BankAccount): Observable<BankAccount> {
    return this.http.post<BankAccount>(`${this.baseUrl}/accounts`, account);
  }

  update(id: number, account: BankAccount): Observable<BankAccount> {
    return this.http.put<BankAccount>(`${this.baseUrl}/accounts/${id}`, account);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/accounts/${id}`);
  }
}
