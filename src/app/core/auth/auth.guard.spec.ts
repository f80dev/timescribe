import { TestBed } from '@angular/core/testing';
import { Router, CanActivateFn } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { provideRouter } from '@angular/router';
import { Component } from '@angular/core';
import { authGuard } from './auth.guard';
import { GoogleAuthService } from './google-auth.service';

@Component({ template: 'protected', selector: 'app-protected' })
class Protected {}

@Component({ template: 'login', selector: 'app-login' })
class LoginPage {}

class FakeAuth {
  authenticated = false;
  isAuthenticated() {
    return this.authenticated;
  }
}

describe('authGuard', () => {
  let router: Router;
  let fake: FakeAuth;

  beforeEach(async () => {
    fake = new FakeAuth();
    await TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'login', component: LoginPage },
          { path: 'protected', component: Protected, canActivate: [authGuard] },
        ]),
        { provide: GoogleAuthService, useValue: fake },
      ],
    }).compileComponents();
    router = TestBed.inject(Router);
  });

  it('redirige vers /login si non authentifié', async () => {
    fake.authenticated = false;
    const result = await router.navigate(['/protected']);
    expect(result).toBe(true);
    // Après navigation, on doit être sur /login (le guard redirige)
    expect(router.url).toBe('/login');
  });

  it('laisse passer si authentifié', async () => {
    fake.authenticated = true;
    const result = await router.navigate(['/protected']);
    expect(result).toBe(true);
    expect(router.url).toBe('/protected');
  });
});