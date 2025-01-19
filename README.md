# CampFlow Server Documentation

Welcome to the CampFlow server documentation. This guide provides detailed information about the setup and functionality of the CampFlow backend server, hosted at [CampFlow Server](https://campflow-ten.vercel.app).

## Overview

The CampFlow server is a express.js-based backend application that provides APIs for managing users, campaigns, registrations, payments, and reviews. It integrates with MongoDB for data storage, Stripe for payment processing, and Nodemailer for email handling. JWT is used for secure authentication.

---

The server is hosted at: [CampFlow Server](https://campflow-ten.vercel.app)

## Environment Variables

To run this server locally, you need to set the following environment variables in a `.env` file. **Do not include actual values in the file for security reasons.**

```env
DB_USER=your_database_username # Username for the database connection
DB_PASS=your_database_password # Password for the database connection
ACCESS_TOKEN=your_jwt_access_token_secret # Secret for signing JWT tokens
STRIPE_SECRET_KEY=your_stripe_secret_key # Secret key for Stripe payment integration
USER_EMAIL=your_email_for_nodemailer # Email address for sending notifications
USER_PASS=your_email_password_for_nodemailer # Password for the email account
```

Ensure these values are set correctly for the server to function properly.

## Dependencies

The server uses the following dependencies:

```json
"dependencies": {
  "cors": "^2.8.5",
  "dotenv": "^16.4.7",
  "express": "^4.21.2",
  "jsonwebtoken": "^9.0.2",
  "mongodb": "^6.12.0",
  "morgan": "^1.10.0",
  "nodemailer": "^6.9.16",
  "stripe": "^17.5.0"
}
```

---

## Installation and Setup

1. **Clone the repository:**

   ```bash
   git clone https://github.com/Sabuj-Chowdhury/CampFlow_Server
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Create `.env` file:**
   Add the required environment variables as mentioned above.

4. **Start the server:**
   ```bash
   npm start
   ```
   The server will run on `http://localhost:8000` by default.

---

## Database Collections

- **Users:** Stores user data.
- **Campaigns:** Stores campaign details.
- **Registrations:** Tracks user registrations.
- **Payments:** Logs payment details.
- **Reviews:** Manages user reviews.

---

## Technologies Used

- **Backend Framework:** Node.js, Express.js
- **Database:** MongoDB
- **Authentication:** JWT
- **Payment Gateway:** Stripe
- **Email Service:** Nodemailer
- **Hosting:** Vercel

---

## Base URL

```
https://campflow-ten.vercel.app
```

---

## Middleware

### `verifyToken`

Validates JWT tokens for secure API access. Adds decoded token to `req.decoded`.

### `verifyAdmin`

Checks if the user is an admin. Requires `verifyToken` middleware.

---

## Routes

### **JWT**

#### Generate JWT Token

- **POST** `/jwt`
- **Description**: Generates a JWT token for a user.
- **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "role": "user"
  }
  ```
- **Response**:
  ```json
  {
    "token": "<JWT_TOKEN>"
  }
  ```

---

### **Users**

#### Save User

- **POST** `/users`
- **Description**: Saves a new user in the database.
- **Request Body**:
  ```json
  {
    "name": "John Doe",
    "email": "john@example.com",
    "password": "securepassword"
  }
  ```
- **Response**:
  ```json
  {
    "insertedId": "<USER_ID>"
  }
  ```

#### Get User Data

- **GET** `/user/:email`
- **Description**: Fetches user details by email.
- **Authorization**: Requires `verifyToken`.

#### Check Admin Status

- **GET** `/user/admin/:email`
- **Description**: Checks if a user is an admin.
- **Authorization**: Requires `verifyToken`.

#### Update User

- **PATCH** `/user/update/:id`
- **Description**: Updates user details.
- **Authorization**: Requires `verifyToken`.
- **Request Body**:
  ```json
  {
    "name": "Updated Name",
    "image": "image_url",
    "address": "Updated Address",
    "phone": "1234567890"
  }
  ```

---

### **Camps**

#### Add Camp

- **POST** `/add-camp`
- **Description**: Adds a new camp.
- **Authorization**: Requires `verifyToken` and `verifyAdmin`.

#### Get All Camps

- **GET** `/camps`
- **Description**: Retrieves all camps.

#### Get Popular Camps

- **GET** `/camps/popular`
- **Description**: Retrieves the top 6 popular camps.

#### Get Camp Details

- **GET** `/camp/:id`
- **Description**: Retrieves details of a specific camp by ID.

#### Search and Sort Camps

- **GET** `/available-camps`
- **Description**: Searches and sorts camps based on query parameters.
- **Query Parameters**:
  - `sort`: `count`, `camp-fees`, or `alphabetical`
  - `search`: Search term

#### Update Camp

- **PUT** `/camp/:id`
- **Description**: Updates camp details.
- **Authorization**: Requires `verifyToken` and `verifyAdmin`.

#### Delete Camp

- **DELETE** `/camp/:id`
- **Description**: Deletes a camp by ID.
- **Authorization**: Requires `verifyToken`.

---

### **Registrations**

#### Save Registration

- **POST** `/camp/registration`
- **Description**: Saves a registration and updates camp count.
- **Authorization**: Requires `verifyToken`.

#### Get All Registrations

- **GET** `/registrations`
- **Description**: Retrieves all registrations.
- **Authorization**: Requires `verifyToken` and `verifyAdmin`.

#### Get Registrations by Email

- **GET** `/registration/:email`
- **Description**: Retrieves all registrations for a specific user.
- **Authorization**: Requires `verifyToken`.

#### Get Registration by ID

- **GET** `/registration/pay/:id`
- **Description**: Retrieves a specific registration by ID.
- **Authorization**: Requires `verifyToken`.

#### Update Registration Status

- **PATCH** `/registration/:id`
- **Description**: Updates the status of a registration.
- **Authorization**: Requires `verifyToken` and `verifyAdmin`.

#### Delete Registration

- **DELETE** `/registration/:id`
- **Description**: Deletes a registration by ID.
- **Authorization**: Requires `verifyToken`.

---

### **Payments**

#### Create Payment Intent

- **POST** `/payment-intent`
- **Description**: Creates a payment intent for Stripe.
- **Authorization**: Requires `verifyToken`.

#### Save Payment

- **POST** `/payments`
- **Description**: Saves payment details and updates registration payment status.
- **Authorization**: Requires `verifyToken`.

#### Get Payment History

- **GET** `/payments/:email`
- **Description**: Retrieves payment history for a user.
- **Authorization**: Requires `verifyToken`.

---

### **Reviews**

#### Add Review

- **POST** `/review`
- **Description**: Adds a review.
- **Authorization**: Requires `verifyToken`.

#### Get Reviews

- **GET** `/reviews`
- **Description**: Retrieves all reviews.

---

### **Analytics**

#### User Stats

- **GET** `/user-stats/:email`
- **Description**: Retrieves statistics for a user (e.g., total camps, total spent).

---

### **Email**

#### Send Email

- **POST** `/email`
- **Description**: Sends an email using Nodemailer.
- **Request Body**:
  ```json
  {
    "name": "John Doe",
    "email": "john@example.com",
    "message": "Hello, I have a question."
  }
  ```

---

### Root

#### Welcome Message

- **GET** `/`
- **Description**: Returns a welcome message for the server.
