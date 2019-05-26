process.on('unhandledRejection', error => {
  throw error;
});

const fs = require('fs-extra');
const path = require('path');
const tempy = require('tempy');
const chalk = require('chalk');
const map = require('lodash/map');
const reverse = require('lodash/reverse');
const sortBy = require('lodash/sortBy');
const prompts = require('prompts');
const chokidar = require('chokidar');
const clipboardy = require('clipboardy');
const { replaceTemplates, getValuesMap } = require('../src/index');
const { appCacheKey } = require('../src/constants');
const cache = require('./cache')(appCacheKey);
const TemplateModel = require('../src/TemplateModel');
const createApp = require('../src/createApp');

function startWatcher(workingDir, templateModel) {
  const templatePath = templateModel.getPath();

  console.log(`Watching ${chalk.magenta(templatePath)} for changes...`);
  console.log();

  const watcher = chokidar.watch('.', {
    ignored: 'node_modules',
    persistent: true,
    ignoreInitial: true,
    cwd: templatePath,
  });

  const valuesMap = getValuesMap(templateModel);

  const generateFile = relativePath => {
    const fullPath = path.join(templatePath, relativePath);
    const fileContents = fs.readFileSync(fullPath, 'utf-8');
    const destinationPath = path.join(workingDir, relativePath);

    const transformedContents = replaceTemplates(fileContents, valuesMap, {
      graceful: true,
    });

    const transformedDestinationPath = replaceTemplates(
      destinationPath,
      valuesMap,
      { graceful: true },
    );

    fs.outputFileSync(transformedDestinationPath, transformedContents);

    console.log(
      `${path.join(path.basename(templatePath), relativePath)} ${chalk.magenta(
        '->',
      )} ${chalk.cyan(transformedDestinationPath)}`,
    );
  };

  watcher.on('change', relativePath => {
    generateFile(relativePath);
  });

  watcher.on('add', relativePath => {
    generateFile(relativePath);
  });

  watcher.on('unlink', relativePath => {
    const destinationPath = path.join(workingDir, relativePath);
    fs.removeSync(destinationPath);
    console.log(chalk.red('removed ') + chalk.cyan(destinationPath));
  });
}

async function askShouldContinueFromCache(cachedProjects) {
  const abortConstant = '__new_project__';
  let canceled;

  const projectsChoices = reverse(
    sortBy(
      map(cachedProjects, (value, title) => {
        const lastModified = new Date(value.lastModified);

        return {
          title: `${title}${chalk.dim(` [${lastModified}]`)}`,
          value,
        };
      }),
      'value.lastModified',
    ),
  );

  const response = await prompts(
    {
      type: 'select',
      name: 'value',
      message: `We've found an old session when you worked on, choose them to continue from the last project`,
      choices: [
        { title: 'I want to start a new session', value: abortConstant },
        ...projectsChoices,
      ],
    },
    {
      onCancel: () => {
        canceled = true;
      },
    },
  );

  if (response.value === abortConstant || canceled) {
    return false;
  }

  response.value.templateModel = TemplateModel.fromJSON(
    response.value.templateModel,
  );

  return response.value;
}

function upsertProjectInCache(templateModel, workingDir) {
  const templateCacheObj = {
    [templateModel.getTitle()]: {
      templateModel,
      workingDir,
      lastModified: Date.now(),
    },
  };

  if (!cache.has()) {
    cache.set(templateCacheObj);
  } else {
    const cachedTemplates = cache.get();

    cache.set({ ...cachedTemplates, ...templateCacheObj });
  }
}

async function init() {
  let templateModel;
  let workingDir;
  let chosenProject;

  if (cache.has()) {
    const cachedProjects = cache.get();

    chosenProject = await askShouldContinueFromCache(cachedProjects);
  }

  if (!!chosenProject) {
    workingDir = chosenProject.workingDir;
    templateModel = chosenProject.templateModel;

    await createApp({
      workingDir,
      templateModel,
      install: false,
      lint: false,
    });
  } else {
    workingDir = tempy.directory();

    templateModel = await createApp({
      workingDir,
      install: false,
      lint: false,
    });
  }

  upsertProjectInCache(templateModel, workingDir);

  clipboardy.writeSync(workingDir);

  console.log('> ', chalk.cyan('directory path has copied to clipboard 📋'));
  console.log();

  startWatcher(workingDir, templateModel);
}

init();
