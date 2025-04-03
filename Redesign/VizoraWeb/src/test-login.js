console.log('Starting direct API login test');

// User credentials
const credentials = {
  email: 'advi@gmail.com',
  password: 'Srini78$$'
};

// API endpoint
const API_URL = 'http://localhost:3003/api/auth/login';

// Test using fetch
console.log('Testing login with fetch:', credentials);

fetch(API_URL, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(credentials)
})
  .then(response => {
    console.log('Response status:', response.status);
    return response.json();
  })
  .then(data => {
    console.log('Response data:', data);
    if (data.token) {
      console.log('Login successful:', data.user);
    } else {
      console.log('Login failed:', data.message);
    }
  })
  .catch(error => {
    console.error('Fetch error:', error);
  });

// Test using XMLHttpRequest for comparison
console.log('\nTesting login with XMLHttpRequest');

const xhr = new XMLHttpRequest();
xhr.open('POST', API_URL, true);
xhr.setRequestHeader('Content-Type', 'application/json');
xhr.onreadystatechange = function() {
  if (xhr.readyState === 4) {
    console.log('XHR status:', xhr.status);
    if (xhr.status === 200) {
      const response = JSON.parse(xhr.responseText);
      console.log('XHR success:', response);
    } else {
      console.log('XHR error:', xhr.statusText);
      try {
        const errorData = JSON.parse(xhr.responseText);
        console.log('XHR error data:', errorData);
      } catch (e) {
        console.log('XHR response text:', xhr.responseText);
      }
    }
  }
};
xhr.send(JSON.stringify(credentials)); 