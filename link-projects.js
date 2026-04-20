const fs = require('fs');
const json5 = require('json5');
const childProcess = require('child_process');
const path = require('path');

const COLORS = {
  INFO: 32,
  WARN: 33,
  ERROR: 31,
};

const PACKAGE_NAME = '@exogroup/ng-material-date-range-picker';
const DIST_PACKAGE_PATH_PARTS = ['dist', 'exogroup', 'ng-material-date-range-picker'];
const IGNORED_PEER_DEPS = new Set(['@angular/core', '@angular/common', 'rxjs']);

// Color ref: https://en.m.wikipedia.org/wiki/ANSI_escape_code#Colors
const prettyPrint = (color, ...log) => console.log(`\x1b[${color}m `, ...log, '\x1b[0m');

const logInfo = (...log) => prettyPrint(COLORS.INFO, ...log);
const logWarn = (...log) => prettyPrint(COLORS.WARN, ...log);
const logError = (...log) => prettyPrint(COLORS.ERROR, ...log);

const printErrAndExit = (message) => {
  logError('Aborting: ' + message);
  process.exit(1);
};

const runCommand = (command, options = {}) => {
  childProcess.execSync(command, { stdio: 'inherit', ...options });
};

const readJson5File = (filePath) => json5.parse(fs.readFileSync(filePath).toString());

const writeJsonFile = (filePath, content) => {
  fs.writeFileSync(filePath, JSON.stringify(content, null, 2));
};

const ensureDistPackagePath = (workspacePath, distPackagePath) => {
  if (fs.existsSync(distPackagePath)) {
    return;
  }

  logWarn('dist package not found, running build:lib:prod to generate it');
  runCommand('npm run build:lib:prod', { cwd: workspacePath });

  if (!fs.existsSync(distPackagePath)) {
    throw new Error('dist package path still missing after build: ' + distPackagePath);
  }
};

const collectDependenciesToInsert = (workspacePath) => {
  const rootPackageJson = readJson5File(path.join(workspacePath, 'package.json'));
  const libPackageJson = readJson5File(path.join(workspacePath, 'projects', 'ng-date-picker', 'package.json'));

  const rootDependencies = rootPackageJson.dependencies || {};
  const peerDependencies = libPackageJson.peerDependencies || {};
  const dependenciesToInsert = {};

  Object.keys(peerDependencies).forEach((dependencyName) => {
    if (IGNORED_PEER_DEPS.has(dependencyName)) {
      return;
    }

    if (rootDependencies[dependencyName]) {
      dependenciesToInsert[dependencyName] = rootDependencies[dependencyName];
    }
  });

  return dependenciesToInsert;
};

const removeLinkedPackage = (projectPackageJson) => {
  let found = false;

  if (projectPackageJson.dependencies && projectPackageJson.dependencies[PACKAGE_NAME]) {
    delete projectPackageJson.dependencies[PACKAGE_NAME];
    found = true;
  }

  if (projectPackageJson.devDependencies && projectPackageJson.devDependencies[PACKAGE_NAME]) {
    delete projectPackageJson.devDependencies[PACKAGE_NAME];
    found = true;
  }

  return found;
};

const updateProjectPackageJson = (projectPath, dependenciesToInsert) => {
  const packageJsonPath = path.join(projectPath, 'package.json');
  const projectPackageJson = readJson5File(packageJsonPath);
  const packageFound = removeLinkedPackage(projectPackageJson);

  if (!packageFound) {
    logWarn(PACKAGE_NAME + ' not found in ' + packageJsonPath + ', skipping');
    return false;
  }

  projectPackageJson.dependencies = projectPackageJson.dependencies || {};
  Object.assign(projectPackageJson.dependencies, dependenciesToInsert);

  logInfo('Writing file: ' + packageJsonPath);
  writeJsonFile(packageJsonPath, projectPackageJson);
  return true;
};

const installAndLinkProject = (projectPath, distPackagePath) => {
  logInfo('Changing to project folder: ' + projectPath);
  process.chdir(projectPath);

  logInfo('Running npm install');
  runCommand('npm install');

  logInfo('Running npm link ' + PACKAGE_NAME + ': ' + projectPath);
  runCommand('npm link ' + PACKAGE_NAME);

  logInfo('Running npm install: ' + distPackagePath);
  runCommand('npm install "' + distPackagePath + '"');
};

const updateProjectTsConfig = (projectPath, distPackagePath) => {
  const tsconfigPath = path.join(projectPath, 'tsconfig.json');
  const tsconfigJson = readJson5File(tsconfigPath);
  const relativePath = path.relative(projectPath, distPackagePath);

  tsconfigJson.compilerOptions = tsconfigJson.compilerOptions || {};
  tsconfigJson.compilerOptions.paths = tsconfigJson.compilerOptions.paths || {};
  tsconfigJson.compilerOptions.paths[PACKAGE_NAME + '/*'] = [relativePath];

  logInfo('Writing file: ' + tsconfigPath);
  writeJsonFile(tsconfigPath, tsconfigJson);
};

try {
  const localConfigPath = path.join(process.cwd(), '.local-config.json');
  if (!fs.existsSync(localConfigPath)) {
    throw new Error('Missing local config file: ' + localConfigPath);
  }

  const localConfig = readJson5File(localConfigPath);
  logInfo('Running command with local config file\n');

  const ngDatePickerPath = process.cwd();
  const distPackagePath = path.join(ngDatePickerPath, ...DIST_PACKAGE_PATH_PARTS);
  const dependenciesToInsert = collectDependenciesToInsert(ngDatePickerPath);

  ensureDistPackagePath(ngDatePickerPath, distPackagePath);

  logInfo('Changing to the ng-material-date-range-picker dist path: ' + distPackagePath + ' and run npm link');
  runCommand('npm link', { cwd: distPackagePath });

  (localConfig?.projects || []).forEach((project) => {
    logInfo('Changing to the ng-material-date-range-picker path: ' + ngDatePickerPath);
    process.chdir(ngDatePickerPath);

    const didUpdatePackageJson = updateProjectPackageJson(project, dependenciesToInsert);
    if (!didUpdatePackageJson) {
      return;
    }

    installAndLinkProject(project, distPackagePath);
    updateProjectTsConfig(project, distPackagePath);
  });

  logInfo('All done');
} catch (e) {
  printErrAndExit(e.message);
}
