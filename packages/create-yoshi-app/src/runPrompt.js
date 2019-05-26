const path = require('path');
const prompts = require('prompts');
const TemplateModel = require('./TemplateModel');
const getQuestions = require('./getQuestions');

module.exports = async (workingDir = process.cwd()) => {
  const questions = getQuestions();

  let promptAborted = false;

  const answers = await prompts(questions, {
    onCancel: () => {
      promptAborted = true;
    },
  });

  if (promptAborted) {
    console.log();
    console.log('Aborting ...');
    process.exit(0);
  }

  // use the basename of the current working directory if projectName wasn't supplied
  answers.projectName = answers.projectName || path.basename(workingDir);

  return new TemplateModel(answers);
};
