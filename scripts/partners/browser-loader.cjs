const ts = require("typescript");
module.exports = function transpile(source) {
  return ts.transpileModule(source, {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.ESNext,
    },
    fileName: this.resourcePath,
  }).outputText;
};
