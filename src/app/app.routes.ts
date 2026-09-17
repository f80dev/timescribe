import { Routes } from '@angular/router';
import { AppShell } from './shell/app-shell';
import { authGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/login/login').then((m) => m.Login),
  },
  {
    path: '',
    component: AppShell,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'corpus',
        loadComponent: () =>
          import('./features/corpus-settings/corpus-settings').then((m) => m.CorpusSettings),
      },
      {
        path: 'import',
        loadComponent: () =>
          import('./features/import-csv/import-csv').then((m) => m.ImportCsv),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/settings/settings').then((m) => m.Settings),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];