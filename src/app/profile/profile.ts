import { Component } from '@angular/core';

@Component({
  selector: 'app-profile',
  standalone: true,
  templateUrl: './profile.html',
  styleUrl: './profile.scss'
})
export class Profile {

  name = 'Narayan Sahu';
  email = 'narayan@example.com';

  roomName = 'Room 204';
  totalRoommates = 4;
  monthlyContribution = 6500;

  editProfile() {
    alert('Edit Profile feature coming soon!');
  }

  changePassword() {
    alert('Change Password feature coming soon!');
  }

  logout() {
    alert('Logout feature coming soon!');
  }

}