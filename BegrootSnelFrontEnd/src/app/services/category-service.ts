import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environment/environment.development';
import { Category } from '../models/category';

// ── DTOs ──────────────────────────────────────────────────────────────────────
// Backend needs: POST /categories, PUT /categories/{id}, DELETE /categories/{id}
// The PUT/DELETE endpoints in CategoryResource.java currently have no @PathParam;
// add `@Path("/{id}") @PathParam("id") Long id` when implementing the backend.

export interface CreateCategoryDto {
  name: string;
  level: number;
  assignable: boolean;
  color?: string;
  parentId?: number;
}

export interface UpdateCategoryDto {
  name: string;
  color?: string;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable({
  providedIn: 'root',
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

  createCategory(dto: CreateCategoryDto): Observable<Category> {
    return this.http.post<Category>(`${this.baseUrl}/categories`, dto);
  }

  updateCategory(id: number, dto: UpdateCategoryDto): Observable<Category> {
    return this.http.put<Category>(`${this.baseUrl}/categories/${id}`, dto);
  }

  deleteCategory(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/categories/${id}`);
  }
}
