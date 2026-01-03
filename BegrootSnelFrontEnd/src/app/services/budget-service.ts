import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { Observable } from "rxjs";
import { environment } from "../../environment/environment.development";
import { Budget } from "../models/budget";

@Injectable({
    providedIn: 'root'
})
export class BudgetService {
    private http = inject(HttpClient);

    private baseUrl = environment.apiUrl; 

    getBudgets(year: number, month: number): Observable<Budget[]> {
        return this.http.get<Budget[]>(`${this.baseUrl}/budgets/${year}/${month}`);
    }

    postBudget(budget: Budget): Observable<Budget> {
        return this.http.post<Budget>(`${this.baseUrl}/budgets`, budget);
    }

    putBudget(budgetId: number, budget: Budget): Observable<Budget> {
        return this.http.put<Budget>(`${this.baseUrl}/budgets/${budgetId}`, budget);
    }

}