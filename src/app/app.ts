import { Component } from '@angular/core';
import {
  RouterOutlet,
  RouterLink,
  RouterLinkActive,
  Router,
} from '@angular/router';
import {
  ChangeDetectorRef,
  ElementRef,
  HostListener,
  ViewChild,
  inject,
} from '@angular/core';
import { defer, finalize } from 'rxjs';
import { AuthService } from './auth/auth.service';
import { RoomService } from './rooms/room.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class AppComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly roomApi = inject(RoomService);
  private readonly changeDetector = inject(ChangeDetectorRef);
  @ViewChild('menuButton') private menuButton?: ElementRef<HTMLButtonElement>;

  menuOpen = false;
  expenseNavigationLoading = false;
  expenseNavigationError = '';

  get isAuthenticated(): boolean {
    return this.auth.isAuthenticated();
  }

  toggleMenu(): void {
    this.menuOpen = !this.menuOpen;
  }

  closeMenu(): void {
    this.menuOpen = false;
  }

  openAddExpense(event: MouseEvent): void {
    event.preventDefault();
    this.closeMenu();
    if (this.expenseNavigationLoading) {
      return;
    }

    this.expenseNavigationError = '';
    this.expenseNavigationLoading = true;
    this.changeDetector.markForCheck();
    defer(() => this.roomApi.getMyRooms())
      .pipe(
        finalize(() => {
          this.expenseNavigationLoading = false;
          this.changeDetector.markForCheck();
        })
      )
      .subscribe({
        next: (rooms) => {
          const currentRoom = rooms[0];
          if (!currentRoom) {
            this.expenseNavigationError =
              'Join or create a room before adding an expense.';
            void this.router.navigate(['/dashboard']);
            this.changeDetector.markForCheck();
            return;
          }

          void this.router.navigate([
            '/rooms',
            currentRoom.roomId,
            'expenses',
            'new',
          ]);
        },
        error: () => {
          this.expenseNavigationError =
            'Your room could not be loaded. Check your connection and try again.';
          this.changeDetector.markForCheck();
        },
      });
  }

  logout(): void {
    this.closeMenu();
    this.auth.logout();
  }

  @HostListener('document:keydown.escape')
  closeMenuOnEscape(): void {
    this.closeMenu();
  }

  @HostListener('document:click', ['$event'])
  closeMenuOnOutsideClick(event: MouseEvent): void {
    if (event.target instanceof Node && !this.isInsideNavigation(event.target)) {
      this.closeMenu();
    }
  }

  private isInsideNavigation(target: Node): boolean {
    return (
      this.menuButton?.nativeElement.contains(target) === true ||
      (target instanceof Element &&
        target.closest('.site-header') !== null)
    );
  }}