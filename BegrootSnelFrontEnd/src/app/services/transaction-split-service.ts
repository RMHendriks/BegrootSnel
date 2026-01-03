import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { Observable } from "rxjs";
import { environment } from "../../environment/environment.development";
import { TransactionSplit } from "../models/transaction-split";
import { SplitViewItem } from "../models/split-view-item";

@Injectable({
    providedIn: 'root'
})
export class TransactionSplitService {
    private http = inject(HttpClient);

    private baseUrl = environment.apiUrl;


    getSplitsByCategory(year: number, month: number, categoryId: number): Observable<SplitViewItem[]> {
        return this.http.get<SplitViewItem[]>(`${this.baseUrl}/splits/${year}/${month}/${categoryId}`);
    }

}