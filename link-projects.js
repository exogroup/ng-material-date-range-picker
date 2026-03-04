const fs = require('fs');
const json5 = require('json5');
const childProcess = require('child_process');
const path = require('path');

const VERBOSE_FORCED = false;
const args = process.argv.slice(2);
const VERBOSE = VERBOSE_FORCED || (args.length > 0 && args[0] === 'verbose');

// Color ref: https://en.m.wikipedia.org/wiki/ANSI_escape_code#Colors
const prettyPrint = (color, ...log) => console.log(`\x1b[${color}m `, ...log, '\x1b[0m');

const printErrAndExit = (x) => {
  prettyPrint(31, 'Aborting: ' + x);
  process.exit(1);
};

try  {
  const localConfig = json5.parse(fs.readFileSync('./.local-config.json'));
  if (localConfig) {
    prettyPrint(32, '📃 Running command with local config file\n');
  } else {
    prettyPrint(34, '🙅 No local config found\n');
  }

  const ngDatePickerPath = `${childProcess.execSync('pwd')}`.trim();

  prettyPrint(32, '📁 Changing to the ng-material-date-range-picker dist path: ' + ngDatePickerPath + '/dist/exogroup/ng-material-date-range-picker and 🔗 Run npm link');
  childProcess.execSync('cd ' + ngDatePickerPath + '/dist/exogroup/ng-material-date-range-picker && npm link');

  localConfig?.projects.forEach(project => {
    // move back to the current ng-material-date-range-picker path
    prettyPrint(32, '📁 Changing to the ng-material-date-range-picker path: ' + ngDatePickerPath);
    process.chdir(ngDatePickerPath);

    // project
    const packageJsonContent = fs.readFileSync(project + '/package.json').toString();
    const findNgDatePicker = packageJsonContent.split('"@exogroup/ng-material-date-range-picker"');

    // Check if ng-material-date-range-picker exists in package.json
    if (findNgDatePicker.length === 1) {
      prettyPrint(33, '⚠️  @exogroup/ng-material-date-range-picker not found in ' + project + '/package.json, skipping');
      return;
    }

    // found ng-material-date-range-picker in package.json
    if (findNgDatePicker.length > 1) {
      const nextCommaIndex = findNgDatePicker[1].indexOf(',');

      // there are more elements
      if (nextCommaIndex > -1) {
        findNgDatePicker[1] = findNgDatePicker[1].substring(nextCommaIndex + 1);
      } else {
        findNgDatePicker[0] = findNgDatePicker[0].slice(0, -1);
      }
    }

    // Get dependencies from ng-material-date-range-picker
    const ngDatePickerPackageJsonContent = fs.readFileSync('./package.json').toString();
    const ngDatePickerDependencies = json5.parse(ngDatePickerPackageJsonContent).dependencies;
    const ngDatePickerLibsPackageJsonContent = fs.readFileSync(ngDatePickerPath + '/projects/ng-date-picker/package.json').toString();
    const ngDatePickerLibsPeerDependencies = json5.parse(ngDatePickerLibsPackageJsonContent).peerDependencies;

    const dependenciesToInsert = [];

    Object.keys(ngDatePickerLibsPeerDependencies).forEach(dependency => {
      // ignore common dependencies in angular projects
      if (['@angular/core', '@angular/common', 'rxjs'].indexOf(dependency) === -1) {
        dependenciesToInsert.push(dependency);
      }
    });

    let newDependenciesContent = '';
    dependenciesToInsert.forEach(dependency => {
      if (ngDatePickerDependencies[dependency]) {
        const dependencyEntry = `"${dependency}": "${ngDatePickerDependencies[dependency]}"`;
        newDependenciesContent += `\n    ${dependencyEntry},`;
      }
    });

    let finalPackageJsonContent = findNgDatePicker[0] + newDependenciesContent + findNgDatePicker[1];

    // Remove any trailing comma from the last dependency entry
    finalPackageJsonContent = finalPackageJsonContent.replace(/,(\s*})/, '$1');

    prettyPrint(32, '✍️ Writing file: ' + project + '/package.json');
    fs.writeFileSync(project + '/package.json', JSON.stringify(json5.parse(finalPackageJsonContent), null, 2));

    // go to the project path
    prettyPrint(32, '📁 Changing to project folder: ' + project);
    process.chdir(project);
    prettyPrint(32, '💾 Running npm install');
    childProcess.execSync('npm install');
    prettyPrint(32, '📁 Running npm link @exogroup/ng-material-date-range-picker: ' + project);
    childProcess.execSync('npm link @exogroup/ng-material-date-range-picker');
    prettyPrint(32, '💾 Running npm install: ' + ngDatePickerPath + '/dist/exogroup/ng-material-date-range-picker');
    childProcess.execSync('npm install "' + ngDatePickerPath + '/dist/exogroup/ng-material-date-range-picker"');

    const tsconfigJson = json5.parse(fs.readFileSync(project + '/tsconfig.json'));
    const relativePath = path.relative(project, `${ngDatePickerPath}/dist/exogroup/ng-material-date-range-picker`);
    tsconfigJson.compilerOptions.paths["@exogroup/ng-material-date-range-picker/*"] = [relativePath];

    prettyPrint(32, '✍️ Writing file: ' + project + '/tsconfig.json');
    fs.writeFileSync(project + '/tsconfig.json', JSON.stringify(tsconfigJson, null, 2));
  });

  prettyPrint(32, '✅️ All done');
} catch (e) {

  printErrAndExit(e.message);
}
