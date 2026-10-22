import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';
import { AuthService } from '../auth/auth.service';
import { Profile } from './profile';

describe('Profile', () => {
  let httpTesting: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Profile],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: {
            currentUser: {
              userId: 7,
              name: 'Test User',
              email: 'test@example.com',
              phone: null,
            },
            logout: () => undefined,
          },
        },
      ],
    }).compileComponents();
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('loads the current room and displays the user room membership role', async () => {
    const fixture = TestBed.createComponent(Profile);
    fixture.detectChanges();

    const invitationsRequest = httpTesting.expectOne(
      `${environment.apiUrl}/api/users/me/invitations`
    );
    expect(invitationsRequest.request.method).toBe('GET');
    invitationsRequest.flush([
      {
        invitationId: 51,
        roomId: 18,
        roomName: 'Cedar Apartment',
        invitedUserId: 7,
        invitedUserName: 'Test User',
        invitedUserEmail: 'test@example.com',
        invitedByMemberId: 44,
        invitedByUserId: 9,
        invitedByName: 'Room Admin',
        status: 'PENDING',
        createdAt: '2026-10-21T10:00:00',
        respondedAt: null,
      },
    ]);

    const request = httpTesting.expectOne(
      `${environment.apiUrl}/api/rooms/my`
    );
    expect(request.request.method).toBe('GET');
    request.flush([
      {
        roomId: 12,
        roomName: 'Bhubaneswar Flat',
        createdBy: {
          userId: 7,
          name: 'Test User',
          email: 'test@example.com',
        },
        createdAt: '2026-10-21T10:00:00',
        memberCount: 2,
      },
    ]);
    const membersRequest = httpTesting.expectOne(
      `${environment.apiUrl}/api/rooms/12/members`
    );
    expect(membersRequest.request.method).toBe('GET');
    membersRequest.flush([
      {
        roomMemberId: 31,
        userId: 7,
        name: 'Test User',
        email: 'test@example.com',
        role: 'ADMIN',
      },
    ]);
    expect(fixture.componentInstance.roomsLoading).toBe(false);
    expect(fixture.componentInstance.rooms).toHaveLength(1);
    await fixture.whenStable();
    fixture.detectChanges();

    const page = fixture.nativeElement as HTMLElement;
    expect(page.textContent).toContain('Bhubaneswar Flat');
    expect(page.textContent).toContain('Room #12');
    expect(page.textContent).toContain('Role: ADMIN');
    expect(page.textContent).toContain('Membership #31');
    expect(page.textContent).toContain('Cedar Apartment');
    expect(page.textContent).toContain('Invited by Room Admin');
    expect(page.textContent).toContain('Cannot accept');
    expect(page.textContent).toContain('Decline');
    expect(
      (page.querySelector('.accept') as HTMLButtonElement).disabled
    ).toBe(true);
    expect(page.querySelector('a[href="/rooms/12"]')).not.toBeNull();
  });
});
