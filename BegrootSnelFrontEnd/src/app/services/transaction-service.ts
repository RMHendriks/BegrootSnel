import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
import { environment } from '../../environment/environment.development';
import { Category } from '../models/category';
import { Transaction } from '../models/transaction';

@Injectable({
    providedIn: 'root'
})
export class TransactionService {
    private http = inject(HttpClient);

    private baseUrl = environment.apiUrl; 

    updateTransaction(transaction: Transaction): Observable<Transaction> {
        return this.putTransaction(transaction);
    }

    getTransactions(): Observable<Transaction[]> {
        return this.http.get<Transaction[]>(`${this.baseUrl}/transactions`);
    }

    putTransaction(transaction: Transaction): Observable<Transaction> {
        return this.http.put<Transaction>(`${this.baseUrl}/transactions/${transaction.id}`, transaction);
    }

    intializeTransactions(): Observable<Transaction> {
        return this.http.get<Transaction>(`${this.baseUrl}/transactions/load`);
    }
}