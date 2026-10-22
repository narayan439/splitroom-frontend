import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './auth/auth.guards';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'dashboard',
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./rooms/room-dashboard').then(
        (component) => component.RoomDashboard
      ),
  },
  {
    path: 'rooms/new',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./rooms/create-room').then((component) => component.CreateRoom),
  },
  {
    path: 'rooms/:roomId/expenses/new',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./add-expense/add-expense').then(
        (component) => component.AddExpenseComponent
      ),
  },
  {
    path: 'rooms/:roomId',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./rooms/room-details').then((component) => component.RoomDetails),
  },
  {
    path: 'add-expense',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./add-expense/add-expense').then(
        (component) => component.AddExpenseComponent
      ),
  },
  {
    path: 'roommates',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./roommates/roommates').then(
        (component) => component.RoommatesComponent
      ),
  },
  {
    path: 'profile',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./profile/profile').then(
        (component) => component.Profile
      ),
  },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./login/login').then(
        (component) => component.Login
      ),
  },
  {
    path: 'register',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./register/register').then(
        (component) => component.Register
      ),
  },
  {
    path: 'expenses',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./expense-history/expense-history').then(
        (component) => component.ExpenseHistory
      ),
  },
  {
    path: 'my-expenses',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./my-expenses/my-expenses').then(
        (component) => component.MyExpensesComponent
      ),
  },

  // Keep wildcard route at the very end
  {
    path: '**',
    redirectTo: '',
  },
];