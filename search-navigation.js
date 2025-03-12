import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function searchInDirectory(dir, searchTerms) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stats = fs.statSync(filePath);
    
    if (stats.isDirectory()) {
      searchInDirectory(filePath, searchTerms);
    } else if (stats.isFile() && (filePath.endsWith('.tsx') || filePath.endsWith('.ts') || filePath.endsWith('.jsx') || filePath.endsWith('.js'))) {
      const content = fs.readFileSync(filePath, 'utf8');
      
      for (const term of searchTerms) {
        if (content.includes(term)) {
          console.log(`\nFound "${term}" in ${filePath}:`);
          
          const lines = content.split('\n');
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes(term)) {
              console.log(`  Line ${i + 1}: ${lines[i].trim()}`);
            }
          }
        }
      }
    }
  }
}

// Search for various navigation and routing patterns
const searchTerms = [
  'navigate(',
  'useNavigate',
  'add-display',
  'to="/displays/add"',
  'to="/displays/add-display"',
  'to={`/displays/add',
  'to={`/displays/add-display',
  'Route path="/displays/add"',
  'Route path="/displays/add-display"',
  '<a href="/displays/add"',
  '<a href="/displays/add-display"',
  'window.location',
  'history.push',
  'onClick={() => navigate'
];

console.log('Searching for navigation and routing patterns...');
searchInDirectory('./src', searchTerms);

// Also check for router configuration
console.log('\nChecking main router configuration:');
try {
  const mainFile = fs.readFileSync('./src/main.tsx', 'utf8');
  console.log('Content of main.tsx:');
  console.log(mainFile);
} catch (err) {
  console.log('Could not read main.tsx:', err.message);
}

// Check App.tsx for router setup
try {
  const appFile = fs.readFileSync('./src/App.tsx', 'utf8');
  console.log('\nContent of App.tsx:');
  console.log(appFile);
} catch (err) {
  console.log('Could not read App.tsx:', err.message);
}
