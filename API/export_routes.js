import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const srcDir = path.join(__dirname, 'src/routes');
const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.routes.js'));

const basePaths = {
  'auth.routes.js': '/api/v1/auth',
  'users.routes.js': '/api/v1/users',
  'sectors.routes.js': '/api/v1/sectors',
  'candidates.routes.js': '/api/v1/candidates',
  'interviews.routes.js': '/api/v1/interviews',
  'questions.routes.js': '/api/v1/questions',
  'notifications.routes.js': '/api/v1/notifications',
  'analytics.routes.js': '/api/v1/analytics'
};

const routes = [];

const regex = /router\.(get|post|put|delete|patch)\((['"`])(.*?)\2/g;

for (const file of files) {
  const content = fs.readFileSync(path.join(srcDir, file), 'utf-8');
  let match;
  while ((match = regex.exec(content)) !== null) {
    const method = match[1].toUpperCase();
    const endpointPath = match[3];
    const fullPath = (basePaths[file] + endpointPath).replace(/\/+/g, '/').replace(/\/$/, '');
    routes.push({ file, method, path: fullPath || '/' });
  }
}

// Add health check
routes.push({ file: 'app.js', method: 'GET', path: '/health' });

let csvContent = 'File,Method,Path\n';
routes.forEach(r => {
  csvContent += `"${r.file}","${r.method}","${r.path}"\n`;
});

fs.writeFileSync(path.join(__dirname, 'api_endpoints_list.csv'), csvContent);
console.log('Successfully written api_endpoints_list.csv');
