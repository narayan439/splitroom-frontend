import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { CreateRoom } from './create-room';
import { RoomService } from './room.service';

describe('CreateRoom', () => {
  it('prevents room creation when the user already has a room', async () => {
    await TestBed.configureTestingModule({
      imports: [CreateRoom],
      providers: [
        provideRouter([]),
        {
          provide: RoomService,
          useValue: {
            getMyRooms: () =>
              of([
                {
                  roomId: 5,
                  roomName: 'Maple House',
                  createdBy: {
                    userId: 1,
                    name: 'Jordan',
                    email: 'jordan@example.com',
                  },
                  createdAt: '2026-10-21T10:00:00',
                  memberCount: 1,
                },
              ]),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(CreateRoom);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const page = fixture.nativeElement as HTMLElement;
    expect(page.textContent).toContain('Maple House');
    expect(page.textContent).toContain('Leaving a room is not currently supported');
    expect(page.querySelector('form')).toBeNull();
  });

  it('allows creation without membership and navigates to the created room', async () => {
    await TestBed.configureTestingModule({
      imports: [CreateRoom],
      providers: [
        provideRouter([]),
        {
          provide: RoomService,
          useValue: {
            getMyRooms: () => of([]),
            createRoom: () =>
              of({
                roomId: 42,
                roomName: 'Maple House',
                createdBy: {
                  userId: 1,
                  name: 'Jordan',
                  email: 'jordan@example.com',
                },
                createdAt: '2026-10-21T10:00:00',
                memberCount: 1,
              }),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(CreateRoom);
    fixture.detectChanges();
    await fixture.whenStable();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate')
      .mockResolvedValue(true);
    const component = fixture.componentInstance;
    component.form.controls.roomName.setValue('Maple House');
    component.submit();
    await fixture.whenStable();

    expect(component.loading).toBe(false);
    expect(navigate).toHaveBeenCalledWith(['/rooms', 42]);
  });

  it('ends membership loading and offers retry after a failed membership request', async () => {
    await TestBed.configureTestingModule({
      imports: [CreateRoom],
      providers: [
        provideRouter([]),
        {
          provide: RoomService,
          useValue: {
            getMyRooms: () =>
              throwError(() => new Error('Backend unavailable')),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(CreateRoom);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.componentInstance.membershipLoading).toBe(false);
    expect(fixture.componentInstance.membershipError).toContain(
      'backend and database'
    );
    expect((fixture.nativeElement as HTMLElement).textContent)
      .toContain('Try again');
  });

  it('updates the page when the asynchronous membership check completes', async () => {
    const memberships = new Subject<[]> ();
    await TestBed.configureTestingModule({
      imports: [CreateRoom],
      providers: [
        provideRouter([]),
        {
          provide: RoomService,
          useValue: {
            getMyRooms: () => memberships,
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(CreateRoom);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent)
      .toContain('Checking your current room');

    memberships.next([]);
    memberships.complete();
    await fixture.whenStable();

    expect(fixture.componentInstance.membershipLoading).toBe(false);
    expect((fixture.nativeElement as HTMLElement).textContent)
      .not.toContain('Checking your current room');
    expect((fixture.nativeElement as HTMLElement).querySelector('form'))
      .not.toBeNull();
  });

  it('shows an asynchronous create error and resets the submit button', async () => {
    const creation = new Subject<never>();
    await TestBed.configureTestingModule({
      imports: [CreateRoom],
      providers: [
        provideRouter([]),
        {
          provide: RoomService,
          useValue: {
            getMyRooms: () => of([]),
            createRoom: () => creation,
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(CreateRoom);
    fixture.detectChanges();
    await fixture.whenStable();
    const component = fixture.componentInstance;
    component.form.controls.roomName.setValue('Maple House');
    component.submit();
    expect(component.loading).toBe(true);

    creation.error(
      new HttpErrorResponse({
        status: 500,
        error: { message: 'Database unavailable' },
      })
    );
    await fixture.whenStable();

    expect(component.loading).toBe(false);
    expect((fixture.nativeElement as HTMLElement).textContent)
      .toContain('database is temporarily unavailable');
    expect((fixture.nativeElement as HTMLElement).textContent)
      .toContain('Create room');
  });

  it('shows a safe database failure and clears submission loading', async () => {
    await TestBed.configureTestingModule({
      imports: [CreateRoom],
      providers: [
        provideRouter([]),
        {
          provide: RoomService,
          useValue: {
            getMyRooms: () => of([]),
            createRoom: () =>
              throwError(
                () =>
                  new HttpErrorResponse({
                    status: 500,
                    error: { message: 'SQL exception: secret database detail' },
                  })
              ),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(CreateRoom);
    fixture.detectChanges();
    await fixture.whenStable();
    const component = fixture.componentInstance;
    component.form.controls.roomName.setValue('Maple House');
    component.submit();

    expect(component.loading).toBe(false);
    expect(component.errorMessage).toContain('database is temporarily unavailable');
    expect(component.errorMessage).not.toContain('secret database detail');
  });
});
