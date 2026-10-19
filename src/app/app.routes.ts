import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./home/home').then((component) => component.Home),
  },
  {
    path: 'add-expense',
    loadComponent: () =>
      import('./add-expense/add-expense').then(
        (component) => component.AddExpenseComponent
      ),
  },
  {
    path: 'roommates',
    loadComponent: () =>
      import('./roommates/roommates').then(
        (component) => component.RoommatesComponent
      ),
  },
  {
    path: 'profile',
    loadComponent: () =>
      import('./profile/profile').then(
        (component) => component.Profile
      ),
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./login/login').then(
        (component) => component.Login
      ),
  },
  {
  path: 'expenses',
  loadComponent: () =>
    import('./expense-history/expense-history')
      .then(component => component.ExpenseHistory),
  },

  // Keep wildcard route at the very end
  {
    path: '**',
    redirectTo: '',
  },
];