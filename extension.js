// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const fs = require("fs");

const factoSelector = { language: "lua", scheme: "file" };

const apiKeysMap = {
	game: "LuaGameScript",
	script: "LuaBootstrap",
	remote: "LuaRemote",
	commands: "LuaCommandProcessor",
	player: "LuaPlayer",
	entity: "LuaEntity",
	inventory: "LuaInventory",
	gui: "LuaGui",
	force: "LuaForce",
	style: "LuaStyle",
	tile: "LuaTile",
};


class FactoCompletion {

	constructor(path) {
		readData(path + '/classes.json').then(data => {
			this.classes = data
			Object.keys(apiKeysMap).forEach(key => {
				if (this.classes[apiKeysMap[key]]) {
					this.classes[key] = this.classes[apiKeysMap[key]]
				}
			})
		})
	}

	provideCompletionItems(document, position, token, context) {
		const linePrefix = document.lineAt(position).text.slice(0, position.character);
		console.log(linePrefix)
		let match = (linePrefix.match(/[\w\[\]]+\.[\w\[\]\.]*/g) || []).pop()
		if (match) {
			let words = match.replaceAll(/\[[^\]]*\]/g, '').split('.')
			words.pop()
			const api = this.findApi(words);
			if (!api || !api.properties) {
				console.log('facto-code', words, api)
				return undefined;
			}
			console.log('facto-code', words, api, Object.keys(api.properties).length)
			let completionItems = Object.keys(api.properties).map(member => this.createCompletionItem(api.properties[member], member));
			console.log('facto-code', completionItems.length, completionItems.map(c => c.detail))
			return completionItems;
		}
		return undefined
	}

	createCompletionItem(props, key) {
        const { doc, name, mode } = props;
        let completionItem = Object.assign(new vscode.CompletionItem(key), {
            detail: props.type,
            documentation: new vscode.MarkdownString([doc, mode].filter(Boolean).join("\n\n")),
            kind: vscode.CompletionItemKind.Property
        });
        if (props.type === "function") {
            Object.assign(completionItem, {
                detail: name,
                kind: vscode.CompletionItemKind.Function
            });
        }
        else if (props.type === "define") {
            Object.assign(completionItem, {
                kind: vscode.CompletionItemKind.Constant
            });
        }
        return completionItem;
    }

	findApi(words) {
		let api = this.classes[words.shift()];
		if (!api || !api.properties) {
			return null;
		}
		if (words.length === 0) {
			return api;
		}
		let props = api.properties;
		words.some(word => {
			api = props[word];
			// Not found
			if (!api) {
				return true
			}
			// First try traverse it's own properties
			if (api.properties) {
				props = api.properties;
			} else {
				// Then the complete type list
				let parentType = api.type;
				// Special handling for defines
				if (/defines/.test(parentType)) {
					let [_, defineName] = parentType.split(".");
					api = defineName && this.classes.defines[defineName] ? this.classes.defines[defineName].properties : null
					return true
				}
				api = this.classes[parentType];
				if (api && api.properties) {
					props = api.properties;
				}
			}
		})
		return api;
	}
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {

	let factoApiPath = context.asAbsolutePath("./api");

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('facto-code', factoApiPath);

	let factoCompletion = new FactoCompletion(factoApiPath)

	context.subscriptions.push(vscode.languages.registerCompletionItemProvider(factoSelector, factoCompletion, '.'));
	// context.subscriptions.push(vscode.languages.registerHoverProvider(factoSelector, new FactorioHover_1.FactorioHover(factorioApiData)));

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with  registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('facto-code.helloWorld', function () {
		// The code you place here will be executed every time your command is executed

		// Display a message box to the user
		vscode.window.showInformationMessage('facto-code', factoApiPath);

	});

	context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
function deactivate() { }

function saveData(file, data) {
	fs.writeFile(file, JSON.stringify(data, null, 2), 'utf8', err => {
		if (err) {
			console.error(err)
		}
	})
}

function readData(file) {
	return new Promise((resolve, reject) => {
		fs.readFile(file, 'utf-8', (error, contents) => {
			if (error) {
				reject(error)
			} else {
				resolve(JSON.parse(contents))
			}
		})
	})
}

module.exports = {
	activate,
	deactivate
}
