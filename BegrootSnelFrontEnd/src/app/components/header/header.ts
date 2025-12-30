import { Component } from '@angular/core';
import { TransactionService } from '../../services/transaction-service';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-header',
  imports: [RouterLink],
  templateUrl: './header.html',
  styleUrl: './header.scss',
})
export class Header {
  isSyncing = false;

  constructor(private transactionService: TransactionService, private router: Router) { }

  syncBankData() {
    this.isSyncing = true;

    // Simuleer een API call naar je Quarkus backend
    this.transactionService.intializeTransactions().subscribe({
      next: (response) => {
        this.router.navigateByUrl('/transactions', { skipLocationChange: true }).then(() => {
          this.router.navigate([this.router.url]);
        });
        this.isSyncing = false;
      },
      error: (error) => {
        console.error('Fout bij synchroniseren van bankgegevens:', error);
        this.isSyncing = false;
      }
    });
  }
}
