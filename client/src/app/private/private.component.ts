// Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { AuthService } from '../auth.service';
import { BehaviorSubject } from 'rxjs';
import { FormGroup, FormControl } from '@angular/forms';
import { loadStripe } from '@stripe/stripe-js';
import { Router } from '@angular/router';
import { environment } from 'src/environments/environment';


@Component({
  selector: 'app-private',
  templateUrl: './private.component.html',
  styleUrls: ['./private.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrivateComponent implements OnInit {

  private userDetails_: BehaviorSubject<any[]> = new BehaviorSubject(undefined);
  public userDetails = this.userDetails_.asObservable();
  public userDetailsForm = new FormGroup({});

  private busy_ = new BehaviorSubject(false);
  public busy = this.busy_.asObservable();

  private errorMessage_ = new BehaviorSubject('');
  public errorMessage = this.errorMessage_.asObservable();

  private userSub = null;

  private email = null;
  public newEmail = new FormControl('');

  public code = new FormControl('');

  constructor(private router: Router, private auth: AuthService) { }

  ngOnInit() {
    this.getUserDetails();
  }

  public async getUserDetails() {
    this.busy_.next(true);
    this.errorMessage_.next('');
    try {
      const userDetails = await this.auth.getUserDetails();
      userDetails.forEach(detail => {
        const control = new FormControl(detail.getValue());
        this.userDetailsForm.addControl(detail.getName(), control);

        if (detail.getName() === 'sub') {
          this.userSub = detail.getValue();
        }

        if (detail.getName() === 'email') {
          this.email = detail.getValue();
        }
      });
      this.userDetails_.next(userDetails);
      const userGroups = await this.auth.getUserGroups();
      userGroups.forEach(group => {
        console.log(group);
      });
    } catch (err) {
      this.errorMessage_.next(err.message || err);
    } finally {
      this.busy_.next(false);
    }
  }

  public async checkout() {
    const baseURL = 'http://localhost:4200';
    const apiKey = environment.stripeApiKey;
    const priceId = environment.stripePriceId;

    const stripe = await loadStripe(apiKey);
    stripe.redirectToCheckout({
      lineItems: [{price: priceId, quantity: 1}],
      mode: 'subscription',
      /*
       * Do not rely on the redirect to the successUrl for fulfilling
       * purchases, customers may not always reach the success_url after
       * a successful payment.
       * Instead use one of the strategies described in
       * https://stripe.com/docs/payments/checkout/fulfill-orders
       */
      successUrl: baseURL + '/private',
      cancelUrl: baseURL + '/private',

      /*
       * Add a parameter to attach string the Cognito and Stripe. 
       */
      clientReferenceId: this.userSub,

      /*
       * Add the following if the address is required.
       */
      billingAddressCollection: 'required',
      shippingAddressCollection: {
        allowedCountries: ['JP'],
      },

      /*
       * Autofill Email to Checkout Form.
       */
      customerEmail: this.email
    })
    .then(function (result) {
      if (result.error) {
        /*
         * If `redirectToCheckout` fails due to a browser or network
         * error, display the localized error message to your customer.
         */
        this.errorMessage_.next(result.error.message);
      }
    });

  }

  public async openCustomerPortal() {
    const jwdToken = this.auth.getJwtToken();
    console.log(jwdToken);
  }

  public async changeEmail() {
    try {
      await this.auth.changeEmail(this.newEmail.value, this.email);
      window.location.reload();
    } catch (err) {
      this.errorMessage_.next(err.message || err);
    } finally {
      this.busy_.next(false);
    }
  }

  public async verifyCode() {
    console.log(this.email, this.code.value)
    try {
      await this.auth.verifyEmail(this.email, this.code.value);
      window.location.reload();
    } catch (err) {
      this.errorMessage_.next(err.message || err);
    } finally {
      this.busy_.next(false);
    }
  }
}
