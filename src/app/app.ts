import { Component } from '@angular/core';
import {
  RouterOutlet,
  RouterLink,
  RouterLinkActive
} from '@angular/router';
import { ElementRef, HostListener, ViewChild } from '@angular/core';

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
  @ViewChild('menuButton') private menuButton?: ElementRef<HTMLButtonElement>;

  menuOpen = false;

  toggleMenu(): void {
    this.menuOpen = !this.menuOpen;
  }

  closeMenu(): void {
    this.menuOpen = false;
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