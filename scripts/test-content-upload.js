const http = require('http');
const fs = require('fs');
const path = require('path');

function makeRequest(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          cookies: res.headers['set-cookie'],
          body: body
        });
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function uploadFile(options, filePath, fieldName, extraFields) {
  return new Promise((resolve, reject) => {
    const boundary = '----FormBoundary' + Math.random().toString(36).substr(2);
    const fileName = path.basename(filePath);
    const fileContent = fs.readFileSync(filePath);
    const ext = path.extname(fileName).toLowerCase();
    const mimeType = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'application/octet-stream';

    let body = '';
    // Add extra fields
    if (extraFields) {
      for (const [key, value] of Object.entries(extraFields)) {
        body += `--${boundary}\r\n`;
        body += `Content-Disposition: form-data; name="${key}"\r\n\r\n`;
        body += `${value}\r\n`;
      }
    }

    // File field header
    const fileHeader = `--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="${fileName}"\r\nContent-Type: ${mimeType}\r\n\r\n`;
    const fileFooter = `\r\n--${boundary}--\r\n`;

    const bodyBuffer = Buffer.concat([
      Buffer.from(body + fileHeader),
      fileContent,
      Buffer.from(fileFooter)
    ]);

    options.headers['Content-Type'] = `multipart/form-data; boundary=${boundary}`;
    options.headers['Content-Length'] = bodyBuffer.length;

    const req = http.request(options, (res) => {
      let resBody = '';
      res.on('data', (chunk) => resBody += chunk);
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          body: resBody
        });
      });
    });
    req.on('error', reject);
    req.write(bodyBuffer);
    req.end();
  });
}

async function run() {
  // Step 1: Login
  console.log('=== Login ===');
  const loginData = JSON.stringify({
    email: 'admin@vizora.test',
    password: 'Test1234!'
  });

  const loginRes = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': loginData.length }
  }, loginData);

  const authCookie = loginRes.cookies.find(c => c.startsWith('vizora_auth_token='));
  const csrfCookie = loginRes.cookies.find(c => c.startsWith('vizora_csrf_token='));
  const authToken = authCookie.split('=')[1].split(';')[0];
  const csrfToken = csrfCookie.split('=')[1].split(';')[0];
  console.log('Logged in successfully');

  const cookieHeader = `vizora_auth_token=${authToken}; vizora_csrf_token=${csrfToken}`;

  // Step 2: Upload test images
  const thumbnailDir = path.join(__dirname, '..', 'static', 'thumbnails');
  const files = fs.readdirSync(thumbnailDir).filter(f => f.endsWith('.jpg') || f.endsWith('.png'));

  console.log(`\n=== Uploading ${files.length} test images ===`);

  for (const file of files) {
    const filePath = path.join(thumbnailDir, file);
    console.log(`\nUploading: ${file} (${fs.statSync(filePath).size} bytes)`);

    const uploadRes = await uploadFile({
      hostname: 'localhost',
      port: 3000,
      path: '/api/content/upload',
      method: 'POST',
      headers: {
        'Cookie': cookieHeader,
        'X-CSRF-Token': csrfToken
      }
    }, filePath, 'file', {
      name: `Test Content - ${file}`,
      type: 'image',
      duration: '30'
    });

    console.log(`  Status: ${uploadRes.status}`);
    try {
      const parsed = JSON.parse(uploadRes.body);
      if (parsed.data || parsed.id) {
        const content = parsed.data || parsed;
        console.log(`  Content ID: ${content.id}`);
        console.log(`  Thumbnail: ${content.thumbnail || content.thumbnailUrl || 'none'}`);
        console.log(`  URL: ${content.url}`);
      } else {
        console.log(`  Response: ${uploadRes.body.substring(0, 200)}`);
      }
    } catch (e) {
      console.log(`  Response: ${uploadRes.body.substring(0, 200)}`);
    }
  }

  // Step 3: List all content to verify thumbnails
  console.log('\n=== Listing all content ===');
  const contentRes = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/content',
    method: 'GET',
    headers: { 'Cookie': cookieHeader }
  });

  console.log(`Content list status: ${contentRes.status}`);
  try {
    const contentList = JSON.parse(contentRes.body);
    const items = contentList.data || contentList;
    if (Array.isArray(items)) {
      console.log(`Total content items: ${items.length}`);
      items.forEach((item, i) => {
        console.log(`\n  [${i + 1}] ${item.name}`);
        console.log(`      ID: ${item.id}`);
        console.log(`      Type: ${item.type}`);
        console.log(`      URL: ${item.url}`);
        console.log(`      Thumbnail: ${item.thumbnail || item.thumbnailUrl || 'NONE'}`);
        console.log(`      MIME: ${item.mimeType}`);
      });
    } else {
      console.log(JSON.stringify(contentList, null, 2));
    }
  } catch (e) {
    console.log(contentRes.body.substring(0, 500));
  }
}

run().catch(console.error);
