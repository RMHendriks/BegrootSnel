import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { Observable } from "rxjs";
import { environment } from "../../environment/environment.development";
import { Category } from "../models/category";

@Injectable({
    providedIn: 'root'
})
export class CategoryService {
    private http = inject(HttpClient);

    private baseUrl = environment.apiUrl; 

    getCategories(): Observable<Category[]> {
        return this.http.get<Category[]>(`${this.baseUrl}/categories`);
    }

    getRootCategories(): Observable<Category[]> {
        return this.http.get<Category[]>(`${this.baseUrl}/categories/root-categories`);
    }
}