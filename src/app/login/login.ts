import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class Login {

  email = '';
  password = '';
  message = '';

  login() {
    if (!this.email || !this.password) {
      this.message = 'Please enter email and password.';
      return;
    }

    this.message = 'Login successful! Welcome to SplitRoom.';
  }
}