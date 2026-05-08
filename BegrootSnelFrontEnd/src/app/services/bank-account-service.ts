import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environment/environment.development';
import { BankAccount } from '../models/bank-account';

// ── Service ───────────────────────────────────────────────────────────────────
@Injectable({ providedIn: 'root' })
export class BankAccountService {
  private http = inject(HttpClient);
  private baseUrl = environment.apiUrl;

  getAll(): Observable<BankAccount[]> {
    return this.http.get<BankAccount[]>(`${this.baseUrl}/accounts`);
  }

  getActive(): Observable<BankAccount[]> {
    return this.http.get<BankAccount[]>(`${this.baseUrl}/accounts/active`);
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
