#!/usr/bin/env node
/* eslint-disable no-undef */

const util = require('util');
const path = require('path');
const fs = require('fs');
const { execSync, exec: execCb } = require('child_process');

const exec = util.promisify(execCb);

// -----------------------------
// Helpers
// -----------------------------
async function runCmd(command, options = {}) {
  try {
    const { stdout, stderr } = await exec(command, options);
    if (stdout) console.log(stdout.trim());
    if (stderr) console.error(stderr.trim());
  } catch (error) {
    console.error(`Error while running command: ${command}`);
    console.error(error.message || error);
    throw error;
  }
}

function hasPnpm() {
  try {
    execSync('pnpm --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// -----------------------------
// Validate arguments
// -----------------------------
if (process.argv.length < 3) {
  console.log('Please specify the target project directory.');
  console.log('For example:');
  console.log('    npx create-nodejs-app my-app');
  console.log('    OR');
  console.log('    npm init nodejs-app my-app');
  process.exit(1);
}

// -----------------------------
// Constants
// -----------------------------
const ownPath = process.cwd();
const folderName = process.argv[2];
const appPath = path.join(ownPath, folderName);
const repo = 'https://github.com/voidchef/node-scaffold.git';

// -----------------------------
// Create project directory
// -----------------------------
try {
  fs.mkdirSync(appPath, { recursive: false });
} catch (err) {
  if (err.code === 'EEXIST') {
    console.log('Directory already exists. Please choose another name for the project.');
  } else {
    console.error('Failed to create directory:');
    console.error(err);
  }
  process.exit(1);
}

// -----------------------------
// Main setup function
// -----------------------------
async function setup() {
  try {
    console.log(`Downloading files from repo: ${repo}`);
    await runCmd(`git clone --depth 1 ${repo} "${folderName}"`);
    console.log('Cloned successfully.\n');

    // Move into app directory
    process.chdir(appPath);

    // Determine package manager
    const usePnpm = hasPnpm();
    const packageManager = usePnpm ? 'pnpm' : 'npm';

    console.log(`Installing dependencies using ${packageManager}...`);
    if (usePnpm) {
      await runCmd('pnpm install');
    } else {
      await runCmd('npm install');
    }
    console.log('Dependencies installed successfully.\n');

    // Copy environment variables
    const envExamplePath = path.join(appPath, '.env.example');
    const envPath = path.join(appPath, '.env');

    if (fs.existsSync(envExamplePath)) {
      fs.copyFileSync(envExamplePath, envPath);
      console.log('Environment file created from .env.example');
    } else {
      console.log('No .env.example file found, skipping environment copy.');
    }

    // Remove .git folder (no external tools)
    const gitDir = path.join(appPath, '.git');
    if (fs.existsSync(gitDir)) {
      fs.rmSync(gitDir, { recursive: true, force: true });
      console.log('Removed existing .git folder.');
    }

    // Remove extra files if they exist
    const extraFiles = [
      'CHANGELOG.md',
      'CODE_OF_CONDUCT.md',
      'CONTRIBUTING.md',
    ];

    for (const file of extraFiles) {
      const filePath = path.join(appPath, file);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    // Clean up lockfiles depending on package manager
    const lockFiles = [
      'yarn.lock',
      'package-lock.json',
      usePnpm ? '' : 'pnpm-lock.yaml', // if using pnpm, keep its lockfile; if using npm, remove pnpm-lock.yaml
    ].filter(Boolean);

    for (const lockFile of lockFiles) {
      const lockPath = path.join(appPath, lockFile);
      if (fs.existsSync(lockPath)) {
        fs.unlinkSync(lockPath);
      }
    }

    console.log('\nInstallation is now complete!\n');
    console.log('We suggest that you start by typing:');
    console.log(`    cd ${folderName}`);
    console.log(
      usePnpm
        ? '    pnpm dev'
        : '    npm run dev'
    );
    console.log('\nEnjoy your production-ready Node.js app!');
    console.log('Check README.md for more info.');
  } catch (error) {
    console.error('\nSomething went wrong during setup:');
    console.error(error.message || error);
    process.exit(1);
  }
}

// -----------------------------
// Run
// -----------------------------
setup();
