const { Octokit } = require('octokit');

module.exports = new Octokit({
  auth: `Your Github API Key`
});