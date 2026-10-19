import { TestBed } from '@angular/core/testing';
import { RoommatesComponent } from './roommates';

describe('RoommatesComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RoommatesComponent],
    }).compileComponents();
  });

  it('should require an actual departure date before confirming absence', () => {
    const fixture = TestBed.createComponent(RoommatesComponent);
    const component = fixture.componentInstance;
    const roommate = component.roommates[0];

    component.beginAbsence(roommate);
    component.confirmAbsence(roommate);

    expect(roommate.status).toBe('Active');
    expect(component.errorMessage).toBe('Enter a valid actual departure date.');
  });

  it('should save the actual departure date', () => {
    const fixture = TestBed.createComponent(RoommatesComponent);
    const component = fixture.componentInstance;
    const roommate = component.roommates[0];

    component.beginAbsence(roommate);
    component.absenceDrafts[roommate.id].departureDate = '2026-10-15';
    component.confirmAbsence(roommate);

    expect(roommate.status).toBe('Temporarily Absent');
    expect(roommate.departureDate).toBe('2026-10-15');
    expect(roommate.returnDate).toBe('');
  });

  it('should require and record the actual return date, retaining absence dates', () => {
    const fixture = TestBed.createComponent(RoommatesComponent);
    const component = fixture.componentInstance;
    const roommate = component.roommates[0];

    component.beginAbsence(roommate);
    component.absenceDrafts[roommate.id].departureDate = '2026-10-15';
    component.confirmAbsence(roommate);
    component.beginReturn(roommate);
    component.confirmReturn(roommate);

    expect(component.errorMessage).toBe('Enter a valid actual return date.');
    expect(roommate.status).toBe('Temporarily Absent');

    component.returnDateDrafts[roommate.id] = '2026-10-20';
    component.confirmReturn(roommate);

    expect(roommate.status).toBe('Active');
    expect(roommate.departureDate).toBe('2026-10-15');
    expect(roommate.returnDate).toBe('2026-10-20');
  });

  it('should not accept a return date before departure', () => {
    const fixture = TestBed.createComponent(RoommatesComponent);
    const component = fixture.componentInstance;
    const roommate = component.roommates[0];

    component.beginAbsence(roommate);
    component.absenceDrafts[roommate.id].departureDate = '2026-10-15';
    component.confirmAbsence(roommate);
    component.beginReturn(roommate);
    component.returnDateDrafts[roommate.id] = '2026-10-14';
    component.confirmReturn(roommate);

    expect(roommate.status).toBe('Temporarily Absent');
    expect(component.errorMessage).toBe(
      'Return date cannot be before the departure date.'
    );
  });

  it('should not display roommate expense-category controls', () => {
    const fixture = TestBed.createComponent(RoommatesComponent);
    fixture.detectChanges();
    const categorySection = (fixture.nativeElement as HTMLElement).querySelector(
      '.category-sharing'
    );

    expect(categorySection).toBeNull();
  });

  it('should restore roommate rules when returning to the page', () => {
    const firstFixture = TestBed.createComponent(RoommatesComponent);
    const firstComponent = firstFixture.componentInstance;
    const roommate = firstComponent.roommates.find(
      item => item.name === 'Rahul'
    );

    if (!roommate) {
      throw new Error('Expected Rahul in the roommate list.');
    }

    firstComponent.beginReturn(roommate);
    firstComponent.returnDateDrafts[roommate.id] = '2026-10-20';
    firstComponent.confirmReturn(roommate);
    firstFixture.destroy();

    const secondFixture = TestBed.createComponent(RoommatesComponent);
    const restoredRoommate = secondFixture.componentInstance.roommates.find(
      item => item.name === 'Rahul'
    );

    expect(restoredRoommate?.status).toBe('Active');
  });
});
