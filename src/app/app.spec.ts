import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AuthService } from './auth/auth.service';
import { AppComponent } from './app';
import { RoomService } from './rooms/room.service';

describe('AppComponent Add Expense navigation', () => {
  it('opens the expense form for the user current room directly', async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: { isAuthenticated: () => true },
        },
        {
          provide: RoomService,
          useValue: {
            getMyRooms: () =>
              of([
                {
                  roomId: 7,
                  roomName: 'Maple House',
                  createdBy: {
                    userId: 1,
                    name: 'Jordan',
                    email: 'jordan@example.com',
                  },
                  createdAt: '2026-10-21T10:00:00',
                  memberCount: 2,
                },
              ]),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AppComponent);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate')
      .mockResolvedValue(true);
    const event = { preventDefault: vi.fn() } as unknown as MouseEvent;

    fixture.componentInstance.openAddExpense(event);
    await fixture.whenStable();

    expect(event.preventDefault).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith([
      '/rooms',
      7,
      'expenses',
      'new',
    ]);
    expect(fixture.componentInstance.expenseNavigationLoading).toBe(false);
  });

  it('shows a retryable error rather than opening the room picker when loading fails', async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: { isAuthenticated: () => true },
        },
        {
          provide: RoomService,
          useValue: {
            getMyRooms: () =>
              throwError(() => new Error('Room service unavailable')),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AppComponent);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate')
      .mockResolvedValue(true);
    fixture.componentInstance.openAddExpense({
      preventDefault: vi.fn(),
    } as unknown as MouseEvent);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.expenseNavigationLoading).toBe(false);
    expect(fixture.componentInstance.expenseNavigationError)
      .toContain('Your room could not be loaded');
    expect(navigate).not.toHaveBeenCalled();
    expect((fixture.nativeElement as HTMLElement).textContent)
      .toContain('Your room could not be loaded');
  });
});
