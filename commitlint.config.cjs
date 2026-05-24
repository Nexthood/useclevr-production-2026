module.exports = {
  extends: ["@commitlint/config-conventional"],
  ignores: [
    (message) => /^PR(?:-\d+)?:\s/.test(message),
    (message) => /^Merge pull request #\d+ /.test(message),
  ],
  rules: {
    "body-max-line-length": [0],
  },
};
