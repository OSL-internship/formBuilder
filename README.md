# FormCraft – Drag-and-Drop Form Builder

FormCraft is a full-stack form builder that allows users to create, customize, preview, publish, and manage forms using drag and drop.

## Features

### Form Builder

- Create forms and reorder fields using drag and drop.
- Customize field properties like label, placeholder, default value, and help text.
- Supports Text, Textarea, Number, Email, Select, Radio, Checkbox, and Date fields.
- Conditional logic with AND/OR operators and chained conditions.
- Field validation, including required fields, email, length, number, and regex validation.
- Import and export forms using JSON.
- Save, load, update, and delete forms.
- Preview forms and submit responses through published forms.
- Responsive design for desktop and mobile.

### Authentication and Authorization

- User registration with name, email, and password.
- Email and password login.
- Google OAuth 2.0 authentication.
- Existing accounts are linked when a Google account uses the same verified email address.
- Secure password hashing using bcrypt.
- HTTP-only cookie-based authentication.
- Session validation and logout.
- Protected form management routes.
- Users can access and manage only their own forms.
- Published forms and response submission remain publicly accessible.
- Login and signup endpoints are rate-limited.

## Tech Stack

**Frontend:** React, Vite, Tailwind CSS, JavaScript, Formik, React Router

**Backend:** Node.js, Express.js, MongoDB, Mongoose

**Authentication:** JWT, bcrypt, Google OAuth 2.0, HTTP-only Cookies

## Installation and Setup

### Prerequisites

- Node.js and npm
- MongoDB
- Google Cloud project with OAuth 2.0 credentials (for Google login)

### Frontend Setup

Install the frontend dependencies from the project root directory:

```bash
npm install
```

Create a `.env` file in the project root and add:

```env
VITE_API_URL=http://localhost:5000/api
VITE_GOOGLE_CLIENT_ID=your_google_client_id
```

Start the frontend development server:

```bash
npm run dev
```

### Backend Setup

Navigate to the server directory and install the dependencies:

```bash
cd server
npm install
```

Create a `.env` file inside the `server` directory and add:

```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
FRONTEND_URL=http://localhost:5173
JWT_SECRET=your_strong_random_secret
GOOGLE_CLIENT_ID=your_google_client_id
```

**Important:**

- Use the same Google OAuth Client ID in both frontend and backend environment files.
- Generate a strong, random `JWT_SECRET`.
- Never commit `.env` files or expose secret values in the repository.

Start the backend server:

```bash
npm start
```

## Authentication and Session Management

FormCraft uses JWT-based authentication stored in an HTTP-only cookie.

- Passwords are hashed using bcrypt before being stored in MongoDB.
- After successful login or Google authentication, the backend generates a JWT and sets it in an HTTP-only cookie.
- The frontend sends cookies with API requests using `credentials: "include"`.
- The backend authentication middleware verifies the token and checks the user's session version.
- The frontend checks the current session through the `/api/auth/me` endpoint.
- Logout invalidates the current session and clears the authentication cookie.

HTTP-only cookies help prevent client-side JavaScript from directly accessing the authentication token.

## API Access and Form Ownership

- Form creation, listing, updating, deletion, publishing, and response management require authentication.
- Each form is associated with its owner.
- Users can manage only the forms they own.
- Published form rendering and public response submission do not require login.

## Testing and Code Quality

Run these commands from the project root directory.

### Run Tests with Coverage

```bash
npm run test:coverage
```

### Run ESLint

```bash
npm run lint
```

### Check Code Formatting

```bash
npm run format:check
```

### Build for Production

```bash
npm run build
```

## Project Purpose

FormCraft aims to simplify form creation and management by combining drag-and-drop functionality, conditional logic, field validation, and secure user authentication in one application.

### Existing Forms Migration

FormCraft now associates each form with an authenticated user through the `userId` field.

Previously created forms do not have an associated owner. These forms are not automatically migrated to any user account.

Before using the authentication-enabled version, existing forms and their associated responses should be deleted from the database if they are no longer required.

All newly created forms will be associated with the logged-in user's account.
