# Manual Test Plan for Vizora Web

## Login Page Tests

### Test Cases
1. **Verify Login Form Renders Correctly**
   - Navigate to the login page
   - Verify email and password fields are present
   - Verify "Sign In" button is displayed
   - Verify "Forgot password?" link is displayed
   - Verify "Don't have an account? Sign Up" link is displayed

2. **Verify Form Validation**
   - Try to submit with empty email and password
   - Verify appropriate error message is shown
   - Enter invalid email format and verify validation error
   - Enter valid email but short password and verify validation error

3. **Verify Successful Login**
   - Enter valid credentials
   - Click "Sign In" button
   - Verify user is redirected to dashboard
   - Verify user session is created (check localStorage for token)

4. **Verify Failed Login**
   - Enter invalid credentials
   - Click "Sign In"
   - Verify appropriate error message is displayed
   - Verify user remains on login page

5. **Verify Loading State**
   - Enter valid credentials
   - Click "Sign In"
   - Verify loading indicator is shown during authentication
   - Verify button is disabled during loading state

6. **Test Navigation Links**
   - Click on "Forgot password?" link
   - Verify navigation to password reset page
   - Navigate back to login
   - Click on "Sign Up" link
   - Verify navigation to registration page

## Registration Page Tests

### Test Cases
1. **Verify Registration Form Renders Correctly**
   - Navigate to the registration page
   - Verify name, email, password, and confirm password fields are present
   - Verify "Create Account" button is displayed
   - Verify "Already have an account? Sign In" link is displayed

2. **Verify Form Validation**
   - Try to submit with empty fields
   - Verify validation errors for each field
   - Test password mismatch scenario
   - Test password complexity requirements

3. **Verify Successful Registration**
   - Fill all fields with valid data
   - Click "Create Account"
   - Verify user is redirected to dashboard or confirmation page
   - Verify new user is created in the system

## Dashboard Tests

### Test Cases
1. **Verify Dashboard Loads After Login**
   - Login with valid credentials
   - Verify dashboard components load correctly
   - Verify user information is displayed

2. **Test Navigation Menu**
   - Verify all navigation links work correctly
   - Test responsive behavior on different screen sizes

## Content Upload Tests

### Test Cases
1. **Verify Content Upload Form**
   - Navigate to content upload page
   - Verify file upload controls are present
   - Verify form fields for content metadata

2. **Test Upload Functionality**
   - Upload various file types (images, videos)
   - Verify upload progress indicator
   - Verify successful upload completion
   - Verify error handling for invalid files

## Display Management Tests

### Test Cases
1. **Verify Display Registration**
   - Navigate to display management
   - Test adding a new display
   - Verify pairing process works

2. **Test Display Monitoring**
   - Verify display status indicators
   - Test filtering and sorting of displays
   - Verify display details page shows correct information

## Schedule Management Tests

### Test Cases
1. **Verify Schedule Creation**
   - Create a new schedule
   - Add content to the schedule
   - Set playback parameters
   - Save and verify schedule is created

2. **Test Schedule Assignment**
   - Assign schedule to a display
   - Verify assignment is reflected in the system
   - Test schedule conflicts handling

## General UI Tests

### Test Cases
1. **Responsive Design Testing**
   - Test the application on various screen sizes
   - Verify UI elements adapt appropriately
   - Test on different browsers (Chrome, Firefox, Safari, Edge)

2. **Accessibility Testing**
   - Test keyboard navigation
   - Verify screen reader compatibility
   - Check color contrast for text elements 