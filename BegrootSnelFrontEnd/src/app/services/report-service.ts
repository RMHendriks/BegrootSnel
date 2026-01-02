import { HttpClient } from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { Observable } from "rxjs";
import { environment } from "../../environment/environment.development";
import { Report } from "../models/report";

@Injectable({
    providedIn: 'root'
})
export class ReportService {
    private http = inject(HttpClient);

    private baseUrl = environment.apiUrl; 

    getReport(startDate: string, endDate: string): Observable<Report> {
        return this.http.get<Report>(`${this.baseUrl}/reports?from=${startDate}&to=${endDate}`);
    }
    
    getReportByYearAndMonth(year: number, month: number): Observable<Report> {
        return this.http.get<Report>(`${this.baseUrl}/reports/${year}/${month}`);
    }
}