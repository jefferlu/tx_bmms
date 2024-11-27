import { Component } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule, UntypedFormGroup, UntypedFormBuilder, Validators, ReactiveFormsModule } from '@angular/forms';

import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { GtsAlertComponent, GtsAlertType } from '@gts/components/alert';
import { gtsAnimations } from '@gts/animations';
import { AuthService } from 'app/core/auth/auth.service';
import { TranslocoModule } from '@jsverse/transloco';
import { MatCheckboxModule } from '@angular/material/checkbox';

@Component({
    selector: 'app-sign-in',
    standalone: true,
    templateUrl: './sign-in.component.html',
    styleUrl: './sign-in.component.scss',
    animations: gtsAnimations,
    imports: [
        RouterLink, FormsModule, ReactiveFormsModule, TranslocoModule, MatCheckboxModule,
        MatButtonModule, MatFormFieldModule, MatInputModule, MatIconModule, MatProgressSpinnerModule,
        GtsAlertComponent
    ],
})
export class SignInComponent {

    signInForm: UntypedFormGroup;
    showAlert: boolean = false;

    alert: { type: GtsAlertType; message: string } = {
        type: 'success',
        message: '123'
    };

    constructor(
        private _activatedRoute: ActivatedRoute,
        private _router: Router,
        private _formBuilder: UntypedFormBuilder,
        private _authService: AuthService
    ) { }

    ngOnInit(): void {
        // Create the form
        this.signInForm = this._formBuilder.group({
            email: ['demo@example.com', [Validators.required, Validators.email]],
            password: ['demo', Validators.required],
            rememberMe: [''],
        });
    }

    signIn(): void {

        // Return if the form is invalid
        if (this.signInForm.invalid) {
            return;
        }

        // Disable the form
        this.signInForm.disable();

        // Hide the alert
        this.showAlert = false;

        this._authService.signIn(this.signInForm.value).subscribe({
            next: (res) => {
                const redirectURL = this._activatedRoute.snapshot.queryParamMap.get('redirectURL') || '/signed-in-redirect';
                // Navigate to the redirect url
                this._router.navigateByUrl(redirectURL);
            },
            error: (e) => {
                // Re-enable the form
                this.signInForm.enable();

                // Reset the form
                //  this.signInNgForm.resetForm();

                // Set the alert
                this.alert = {
                    type: 'error',
                    message: e.status === 401 ? '帳號/密碼不存在。' : `${e.message}` //auth.interceptor catchError()
                };

                if (e.status === 401) {
                    this.alert.message = '帳號/密碼不存在。'
                }
                else if (e.error && e.error.detail) {
                    this.alert.message = e.error.detail
                }
                else {
                    this.alert.message = e.message
                }

                // Show the alert
                this.showAlert = true;

            }
        })
    }
}
