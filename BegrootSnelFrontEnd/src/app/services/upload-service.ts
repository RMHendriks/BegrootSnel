import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environment/environment.development';
import { UploadedFile } from '../models/uploaded-file';

// ── Service ───────────────────────────────────────────────────────────────────
@Injectable({ providedIn: 'root' })
export class UploadService {
  private http = inject(HttpClient);
  private baseUrl = environment.apiUrl;

  getUploadedFiles(): Observable<UploadedFile[]> {
    return this.http.get<UploadedFile[]>(`${this.baseUrl}/uploads`);
  }

  getUploadedFilesForAccount(accountId: number): Observable<UploadedFile[]> {
    return this.http.get<UploadedFile[]>(`${this.baseUrl}/uploads?accountId=${accountId}`);
  }

  uploadFile(file: File): Observable<UploadedFile> {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.http.post<UploadedFile>(`${this.baseUrl}/uploads`, form);
  }

  /** Call when the user presses X on a gap warning. Persists the acknowledgement. */
  acknowledgeGap(id: number): Observable<UploadedFile> {
    return this.http.put<UploadedFile>(`${this.baseUrl}/uploads/${id}/acknowledge`, null);
  }

  deleteUploadedFile(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/uploads/${id}`);
  }
}
