// Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

import { Injectable, Inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { Auth, API } from 'aws-amplify';
import { CognitoUser } from 'amazon-cognito-identity-js';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private cognitoUser: CognitoUser & { challengeParam: { email: string } };

  // Get access to window object in the Angular way
  private window: Window;
  constructor(@Inject(DOCUMENT) private document: Document) {
    this.window = this.document.defaultView;
  }

  public async signIn(email: string) {
    this.cognitoUser = await Auth.signIn(email);
  }

  public async signOut() {
    await Auth.signOut();
  }

  public async answerCustomChallenge(answer: string) {
    this.cognitoUser = await Auth.sendCustomChallengeAnswer(this.cognitoUser, answer);
    return this.isAuthenticated();
  }

  public async getPublicChallengeParameters() {
    return this.cognitoUser.challengeParam;
  }

  public async signUp(email: string, name: string, gender: string, birthyear: string) {
    const params = {
      username: email,
      password: this.getRandomString(30),
      attributes: {
        name: name,
        gender: gender,
        'custom:birthyear': birthyear
      }
    };
    await Auth.signUp(params);
  }

  private getRandomString(bytes: number) {
    const randomValues = new Uint8Array(bytes);
    this.window.crypto.getRandomValues(randomValues);
    return Array.from(randomValues).map(this.intToHex).join('');
  }

  private intToHex(nr: number) {
    return nr.toString(16).padStart(2, '0');
  }

  public async isAuthenticated() {
    try {
      await Auth.currentSession();
      return true;
    } catch {
      return false;
    }
  }

  public async getUserDetails() {
    if (!this.cognitoUser) {
      this.cognitoUser = await Auth.currentAuthenticatedUser();
    }
    return await Auth.userAttributes(this.cognitoUser);
  }

  public async getUserGroups() {
    const user = await Auth.currentAuthenticatedUser({bypassCache: true});
    const groups = await user.getSignInUserSession().getAccessToken().payload["cognito:groups"];
    if (!groups) {
      return [];
    }
    return groups;
  }

  public async openCustomerPortral() {
    const requestUrl = environment.apiBaseUrl + '/stripe/customer_portal'
    const returnUrl = 'http://localhost:4200/private'
    const jwtToken = (await Auth.currentSession()).getIdToken().getJwtToken();

    const response = fetch(requestUrl, {
      method: 'POST',
      mode: 'cors',
      referrerPolicy: 'unsafe-url',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': jwtToken
      },
      body: JSON.stringify({
        returnUrl: returnUrl
      })
    })
    .then(response => {
      response.json().then(data => {
        window.location = data.url;
      })
    })
    .catch(error => console.error(error))
  }

  public async changeEmail(newEmail, oldEmail) {
    if (!this.cognitoUser) {
      this.cognitoUser = await Auth.currentAuthenticatedUser();
    }
    const result = await Auth.updateUserAttributes(this.cognitoUser, {
      email: newEmail,
      'custom:validated_email': oldEmail
    });

    return result;
  }

  public async verifyEmail(email: string, code: string) {
    if (!this.cognitoUser) {
      this.cognitoUser = await Auth.currentAuthenticatedUser();
    }
    const result = await Auth.verifyUserAttributeSubmit(this.cognitoUser, 'email', code);
    if (result === 'SUCCESS') {
      const result2 = await Auth.updateUserAttributes(this.cognitoUser, {
        email: email,
        'custom:validated_email': email,
      });
      return result2;
    } else {
      return result;
    }
  }
}
