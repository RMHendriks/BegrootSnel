import { Component } from '@angular/core';
import { TransactionService } from '../../services/transaction-service';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-header',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './header.html',
  styleUrl: './header.scss',
})
export class Header {
  isSyncing = false;
  isMobileMenuOpen = false;

  constructor(
    private transactionService: TransactionService,
    private router: Router,
  ) {}

  syncBankData() {
    this.isSyncing = true;
    this.transactionService.intializeTransactions().subscribe({
      next: () => {
        this.router.navigateByUrl('/transactions', { skipLocationChange: true }).then(() => {
          this.router.navigate([this.router.url]);
        });
        this.isSyncing = false;
      },
      error: (error) => {
        console.error('Fout bij synchroniseren van bankgegevens:', error);
        this.isSyncing = false;
      },
    });
  }

  toggleMobileMenu(): void {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
  }

  closeMobileMenu(): void {
    this.isMobileMenuOpen = false;
  }
}
