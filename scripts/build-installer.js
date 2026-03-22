import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const packageJsonPath = path.join(rootDir, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const appVersion = packageJson.version || '1.0.0';
const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const buildSuffix = `-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

console.log('Building INVENTRA custom installer...\n');

// Check if Inno Setup is installed
let isccPath = null;
const possiblePaths = [
  'C:\\Program Files (x86)\\Inno Setup 6\\ISCC.exe',
  'C:\\Program Files\\Inno Setup 6\\ISCC.exe',
  'C:\\Program Files (x86)\\Inno Setup 5\\ISCC.exe',
  'C:\\Program Files\\Inno Setup 5\\ISCC.exe'
];

// Try to find ISCC.exe
for (const path of possiblePaths) {
  if (fs.existsSync(path)) {
    isccPath = path;
    break;
  }
}

// Try to find via PATH
try {
  execSync('iscc /?', { stdio: 'ignore' });
  isccPath = 'iscc'; // Use from PATH
} catch (error) {
  // Not in PATH, continue checking
}

if (!isccPath) {
  console.error('ERROR: Inno Setup Compiler (iscc) not found!');
  console.error('Please install Inno Setup from: https://jrsoftware.org/isinfo.php');
  console.error('Make sure to add Inno Setup to your PATH or install it in the default location.');
  console.error('\nCommon installation paths:');
  console.error('  - C:\\Program Files (x86)\\Inno Setup 6\\ISCC.exe');
  console.error('  - C:\\Program Files\\Inno Setup 6\\ISCC.exe');
  process.exit(1);
}

console.log('Step 1: Building frontend...');
try {
  execSync('npm run build', { cwd: rootDir, stdio: 'inherit' });
  console.log('✓ Frontend build completed\n');
} catch (error) {
  console.error('ERROR: Frontend build failed');
  process.exit(1);
}

console.log('Step 2: Building Electron win-unpacked...');
try {
  execSync('npx electron-builder --win dir --x64', { cwd: rootDir, stdio: 'inherit' });
  console.log('✓ Electron package completed\n');
} catch (error) {
  console.error('ERROR: Electron win-unpacked build failed');
  process.exit(1);
}

console.log('Step 3: Compiling Inno installer...');
const issFile = path.join(rootDir, 'build-installer.iss');
const outputDir = path.join(rootDir, 'release');

try {
  const defines = [
    `/DMyAppVersion=${appVersion}`,
    `/DMyOutputSuffix=${buildSuffix}`,
    `/DSourceDir="${path.join(rootDir, 'release', 'win-unpacked')}"`,
    `/DMyAppIcon="${path.join(rootDir, 'src', 'assets', 'jbologo.ico')}"`,
  ];
  const isccCommand = isccPath === 'iscc'
    ? `iscc ${defines.join(' ')} "${issFile}"`
    : `"${isccPath}" ${defines.join(' ')} "${issFile}"`;

  execSync(isccCommand, { cwd: rootDir, stdio: 'inherit' });
  console.log('\n✓ Installer compiled successfully!');
  console.log(`\nInstaller location: ${outputDir}`);

  const installerFiles = fs
    .readdirSync(outputDir)
    .filter((f) => f.toLowerCase().includes('inventra-setup') && f.toLowerCase().endsWith('.exe'));
  if (installerFiles.length > 0) {
    console.log(`\nGenerated installer: ${installerFiles[0]}`);
  }
} catch (error) {
  console.error('ERROR: Installer compilation failed');
  console.error(error.message);
  process.exit(1);
}
