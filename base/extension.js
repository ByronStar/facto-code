"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = require("vscode");
const FactorioApiData_1 = require("./FactorioApiData");
const FactorioAutocomplete_1 = require("./FactorioAutocomplete");
const FactorioHover_1 = require("./FactorioHover");
const LUA_MODE = { language: "lua", scheme: "file" };
function activate(context) {
    let dataPath = context.asAbsolutePath("./data");
    const factorioApiData = new FactorioApiData_1.default(dataPath);
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider(LUA_MODE, new FactorioAutocomplete_1.FactorioAutocomplete(factorioApiData), '.'));
    context.subscriptions.push(vscode.languages.registerHoverProvider(LUA_MODE, new FactorioHover_1.FactorioHover(factorioApiData)));
}
exports.activate = activate;
// this method is called when your extension is deactivated
function deactivate() {
}
exports.deactivate = deactivate;
//# sourceMappingURL=extension.js.map