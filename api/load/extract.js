const fs = require('fs')
const osmosis = require('osmosis')

const urls = {
    factorio: "https://lua-api.factorio.com/latest/", // direct
    proxy: "http://localhost:3001/", // node proxy.js - due to an issue with osmosis/needle in accessing web URLs a proxy is needed
    localPy: "http://localhost:8000/", // python3 -m http.server
}

let classes = {
    defines: {
        type: "define",
        properties: {
            events:
            {
                type: "define",
                properties: {}
            }
        }
    }
}

let defines = classes.defines.properties
let events = defines.events.properties

// processMain()
// processClass('LuaAISettings')
// processClass('LuaBootstrap')
// processClass('LuaCommandProcessor')
// Pages with issues
// processClass('LuaAccumulatorControlBehavior')
// processClass('LuaTransportLine')
// processClass('LuaAchievementPrototyp5')

// processClasses(urls.proxy)
// processDefines(urls.localPy)
processConcepts(urls.localPy)

// testSearch()

function testSearch() {
    let classes = {}

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

    function findApi(words) {
        // find the top api class
        let api = classes[words.shift()]
        console.log('BEG', api.name)
        // if there are more words to match and there is an api class with properties
        while (words.length > 0 && api && api.properties) {
            // the next word must be a property of the current api
            let prop = words.shift()
            console.log('NXT', prop)
            // if the property exists in the api class, use the property type for further search
            if (api.properties[prop]) {
                // is the prop a function call?
                if (api.properties[prop].returns) {
                    api = classes[api.properties[prop].returns]
                    console.log('RET', api?.name)
                } else {
                    const type = api.properties[prop].type
                    // is the type a define?
                    if (type.startsWith('defines')) {
                        const [_, define] = type.split(".");
                        api = define && classes.defines.properties[define] ? classes.defines.properties[define] : null
                        console.log('DEF', api?.name)
                    } else {
                        api = classes[type]
                        console.log('TYP', api?.name)
                    }
                }
            }
        }
        return api
    };

    function findType(words) {
        let type = classes[words.shift()];
        if (!type) {
            return null;
        }
        if (!type.properties || words.length === 0) {
            return type;
        }
        let props = type.properties;
        for (let i = 0; i < words.length; i++) {
            type = props[words[i]];
            // Not found
            if (!type)
                return null;
            // First try traverse it's own properties
            if (type.properties) {
                props = type.properties;
                continue;
            }
            // Then the complete type list
            let parentType = type.type;
            // Special handling for defines
            if (/defines/.test(parentType)) {
                let [__, defineName] = parentType.split(".");
                return defineName && classes.defines.properties[defineName] || null
            }
            type = classes[parentType];
            if (type && type.properties) {
                props = type.properties;
                continue;
            }
        }
        return type;
    }

    readData('./api/classes.json').then(data => {
        classes = data
        Object.keys(apiKeysMap).forEach(key => {
            if (classes[apiKeysMap[key]]) {
                classes[key] = classes[apiKeysMap[key]]
            }
        })

        Object.keys(classes).filter(api => api.startsWith('Lua')).forEach(api => {
            classes[api].inherits.forEach(ih => {
                const matches = ih.match(/(Inherited from )(.*): (([^,]+),?) */)
                // console.log(api, matches[2], ih.substring(matches[2].length + 17).split(', '))
                ih.substring(matches[2].length + 17).split(', ').forEach(prop => {
                    classes[api].properties[prop] = classes[matches[2]].properties[prop]
                })
            })
        })

        // findValue('LuaPlayer', 'returns', 'uint')
        // findPropsValueAll('returns', 'LuaPlayer')
        // findPropsValueAll('type', 'LuaBurner')
        // findPropsValueAll('returns', 'LuaGameScript')
        const tests = [
            ['game'], // Lua... api class
            ['game', 'mod_setting_prototypes'], // property with Lua... api class
            ['game', 'mod_setting_prototypes', 'help'], // Lua... api class property :: function
            ['game', 'mod_setting_prototypes', 'object_name'], // Lua... api class property :: string
            ['game', 'mod_setting_prototypes', 'obje'], // Lua... api class property prefix
            ['LuaControlBehavior', 'get_circuit_network', 'wire_type'], // Lua... api class define
            ['LuaEntity', 'get_circuit_network', 'wire_type'], // Lua... api class define
            ['LuaEntity', 'fluidbox', 'owner'], // Lua... api class define
            ['LuaEntity', 'fluidbox', 'owner', 'direction'], // Lua... api class define
            ['LuaEntity', 'surface'], // Lua... api class define
        ]
        tests.forEach(words => {
            console.log(words, findApi([...words])?.name)
            console.log(words, findType([...words])?.name)
        })
    })

    function findPropsValueAll(prop, value) {
        Object.keys(classes).filter(api => api.startsWith('Lua')).forEach(api => {
            findPropsValue(api, prop, value)
        })
    }

    function findPropsValue(api, prop, value) {
        const properties = classes[api].properties
        const results = Object.keys(properties).filter(p => properties[p][prop] && (value == null || properties[p][prop].includes(value))).map(p => properties[p])
        if (results.length > 0) {
            console.log(api, results)
        }
    }
}

function processClasses(proxy) {
    osmosis
        .get(proxy + "classes.html")
        .config({
            user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4.1 Safari/605.1.15',
            tries: 1,
            concurrency: 1
        })
        .find("div.class-attribute-table")
        .set({
            name: "h2 > a",
            type: "h2 > a",
            inherits: ["td:contains('Inherited from')"],
            properties: [
                osmosis
                    .find("tr:not(.tr-separate-description)")
                    .set({
                        name: "span.docs-attribute-name > a",
                        type: "span.docs-attribute-type > a",
                        mode: "span.docs-attribute-note",
                        doc: "div.docs-attribute-description:not(:empty)"
                    })
            ]
        })
        .then((context, data, next) => {
            console.log("classes page: ", data.name);
            data.properties = data.properties.filter(prop => typeof prop != 'string')
            data.properties.forEach(prop => {
                if (prop.doc) {
                    prop.doc = prop.doc.replace(/\n */g, " ")
                }
            });
            classes[data.name] = data;
            next(context, {});
        })
        .select("h2 > a")
        .follow("@href")
        .find("div.docs-content")
        .set({
            name: "h2 > a",
            type: "h2 > a",
            doc: "p:first",
            inherits: ["td:contains('Inherited from')"],
            properties: [
                osmosis
                    .find("div.class-attribute-table tr:not(.tr-separate-description)")
                    .set({
                        name: "span.docs-attribute-name > a",
                        type: "span.docs-attribute-type > a",
                        mode: "span.docs-attribute-note",
                        doc: "div.docs-attribute-description:not(:empty)"
                    })
            ]
        })
        // .data(data => console.log('CLS', data))
        .then((context, data, next) => {
            console.log("class page: ", data.name);
            data.properties.forEach(prop => {
                if (prop.mode == '') {
                    delete prop.mode
                }
                if (prop.doc != undefined) {
                    prop.doc = prop.doc.replace(/\n */g, " ")
                }
            });
            data.properties = data.properties.reduce((a, v) => ({ ...a, [v.name]: v }), {})
            delete data.properties.undefined
            classes[data.name] = data;
            // next(context.querySelector("div.ml16.mb16"), { class: data.name });
            next(context, { class: data.name });
        })
        .find("div.ml16.mb16 > div")
        .set({
            member: "h3",
            name: "node() !> div@id", // gets the id of parent div.element (!> is parent)
            doc: "p:first",
            args: [
                osmosis
                    .find("tr")
                    .set({
                        name: "span.docs-attribute-name",
                        type: "span.docs-attribute-type:first",
                        doc: "div.docs-attribute-description",
                    })
            ]
        })
        .data(data => {
            // console.log('DAT', data)
            if (classes[data.class].properties[data.name]) {
                if (data.doc) {
                    classes[data.class].properties[data.name].short = classes[data.class].properties[data.name].doc
                    classes[data.class].properties[data.name].doc = data.doc.replace(/\n */g, " ")
                }
                classes[data.class].properties[data.name].member = data.member.replace(/\n */g, " ")

                if (classes[data.class].properties[data.name].member.includes('(')) {
                    classes[data.class].properties[data.name].type = 'function'
                    classes[data.class].properties[data.name].returns = 'null'
                }
                data.args.forEach((arg, i) => {
                    if (arg.doc) {
                        arg.doc = arg.doc.replace(/\n */g, " ")
                    }
                    if (arg.type) {
                        arg.type = arg.type.replace(/:: /, '')
                    }
                });
                let args = data.args.reduce((a, v) => ({ ...a, [v.name]: v }), {})
                if (args.undefined) {
                    if (args.undefined.type) {
                        classes[data.class].properties[data.name].returns = args.undefined.type.replace(/→./, '').replace(/\?$/, '')
                        if (args.undefined.doc) {
                            classes[data.class].properties[data.name].doc += " Returns: " + args.undefined.doc
                        } else {
                            console.log(data.name, args.undefined)
                        }
                    }
                    delete args.undefined
                }
                if (Object.keys(args).length != 0) {
                    classes[data.class].properties[data.name].args = args
                }
            } else {
                console.log('???', data)
            }
        })
        .done(function () {
            // console.log(JSON.stringify(classes, null, 2));
            // saveData('./api/classes.json', classes)
            processDefines(proxy)
        })
        // .data(data => console.log('DAT', data))
        .log(data => console.log('LOG', data))
        .error(data => console.log('ERR', data))
}

function processDefines(proxy) {
    osmosis
        .get((proxy + "defines.html"))
        .find("div.ml16.mb16 > div")
        .set({
            name: "h3",
            properties: [
                osmosis
                    .find("tr")
                    .set({
                        name: "span.docs-attribute-name",
                        doc: "div.docs-attribute-description",
                    })
            ]
        })
        // .data(data => console.log('DAT', data))
        .then((context, data, next) => {
            console.log("defines page: ", data.name);
            data.properties.forEach(prop => {
                if (prop.doc == '') {
                    delete prop.doc
                }
                if (prop.doc != undefined) {
                    prop.doc = prop.doc.replace(/\n */g, " ")
                }
                prop.type = "define"
            });
            data.properties = data.properties.reduce((a, v) => {
                const id = ('' + v.name).replace('defines.' + data.name + '.', '')
                return ({ ...a, [id]: v })
            }, {})
            data.type = "define"
            defines[data.name] = data;
            next(context, {});
        })
        .done(function () {
            // console.log(JSON.stringify(defines, null, 2));
            processEvents(proxy)
            // saveData('./api/defines.json', defines)
        })
        .log(data => console.log('LOG', data))
        .error(data => console.log('ERR', data))
}

function processEvents(proxy) {
    osmosis
        .get((proxy + "events.html"))
        .find("div.ml16.mb16 > div")
        .set({
            name: "h3",
            doc: "p:first",
            attrs: [
                osmosis
                    .find("tr")
                    .set({
                        name: "span.docs-attribute-name",
                        doc: "div.docs-attribute-description",
                    })
            ]
        })
        // .data(data => console.log('DAT', data))
        .then((context, data, next) => {
            console.log("events page: ", data.name);
            data.attrs.forEach(prop => {
                if (prop.doc == '') {
                    delete prop.doc
                }
                if (prop.doc != undefined) {
                    prop.doc = prop.doc.replace(/\n */g, " ")
                }
                prop.name = ('' + prop.name).replace('defines.events.', '')
                prop.type = "event"
            });
            data.attrs = data.attrs.reduce((a, v) => ({ ...a, [v.name]: v }), {})
            delete data.attrs.undefined
            events[data.name] = data;
            next(context, {});
        })
        .done(function () {
            // console.log(JSON.stringify(defines, null, 2));
            saveData('./api/classes.json', classes)
        })
        .log(data => console.log('LOG', data))
        .error(data => console.log('ERR', data))
}

function processConcepts(proxy) {
    let concepts = {}
    osmosis
        .get((proxy + "concepts.html"))
        .find("div.ml16.mb16 > div")
        .set({
            name: "h3",
            doc: "p:first",
            attrs: [
                osmosis
                    .find("tr")
                    .set({
                        name: "span.docs-attribute-name",
                        type: "span.docs-attribute-type",
                        doc: "div.docs-attribute-description",
                    })
            ]
        })
        // .data(data => console.log('DAT', data))
        .then((context, data, next) => {
            const m = data.name.match(/([^ ]+)\s+::\s(.*)/)
            data.name = m[1]
            data.type = m[2]
            console.log("concepts page: ", data.name, m[2]);
            // if (data.type == 'union') {
            data.attrs.forEach(prop => {
                if (prop.doc == '') {
                    delete prop.doc
                }
                if (prop.doc != undefined) {
                    prop.doc = prop.doc.replace(/\n */g, " ")
                }
                prop.name = ('' + prop.name).replace(/"/g, '')
                if (prop.type) {
                    prop.type = prop.type.replace(/::\s/, '').replace(/\?$/, '')
                }
            });
            data.attrs = data.attrs.reduce((a, v) => ({ ...a, [v.name]: v }), {})
            delete data.attrs.undefined
            concepts[data.name] = data;
            next(context, {});
        })
        .done(function () {
            // console.log(JSON.stringify(defines, null, 2));
            saveData('./api/concepts.json', concepts)
        })
        .log(data => console.log('LOG', data))
        .error(data => console.log('ERR', data))
}

// test extraction of main page (classes.html) locally
function processMain() {
    osmosis
        .get(urls.localPy + "classes.html")
        .config({
            user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.4.1 Safari/605.1.15',
            tries: 1,
            concurrency: 1
        })
        .find("div.class-attribute-table")
        .set({
            name: "h2 > a",
            type: "h2 > a",
            inherits: ["td:contains('Inherited from')"],
            properties: [
                osmosis
                    .find("tr:not(.tr-separate-description)")
                    .set({
                        name: "span.docs-attribute-name > a",
                        type: "span.docs-attribute-type > a",
                        mode: "span.docs-attribute-note",
                        doc: "div.docs-attribute-description:not(:empty)"
                    })
            ]
        })
        .then((context, data, next) => {
            console.log("classes page: ", data.name);
            data.properties = data.properties.filter(prop => typeof prop != 'string')
            data.properties.forEach(prop => {
                if (prop.doc) {
                    prop.doc = prop.doc.replace(/\n */g, " ")
                }
            });
            data.properties = data.properties.reduce((a, v) => ({ ...a, [v.name]: v }), {})
            classes[data.name] = data;
            next(context, {});
        })
        .select("h2 > a")
        .set({ href: "@href" })
        .data(data => console.log('DAT', data))
        .done(function () {
            // console.log(JSON.stringify(classes, null, 2));
            saveData('./api/main.json', classes)
        })
        .log(data => console.log('LOG', data))
        .error(data => console.log('ERR', data))
}

function processClass(clazz) {
    osmosis
        .get(urls.localPy + "classes/" + clazz + ".html")
        .find("div.docs-content")
        .set({
            name: "h2 > a",
            type: "h2 > a",
            doc: "p:first",
            inherits: ["td:contains('Inherited from')"],
            properties: [
                osmosis
                    .find("div.class-attribute-table tr:not(.tr-separate-description)")
                    .set({
                        name: "span.docs-attribute-name > a",
                        type: "span.docs-attribute-type > a",
                        mode: "span.docs-attribute-note",
                        doc: "div.docs-attribute-description:not(:empty)"
                    })
            ]
        })
        // .data(data => console.log('CLS', data))
        .then((context, data, next) => {
            console.log("class: ", data.name);
            data.properties.forEach(prop => {
                if (prop.mode == '') {
                    console.log(prop.name)
                    delete prop.mode
                }
                if (prop.doc != undefined) {
                    prop.doc = prop.doc.replace(/\n */g, " ")
                }
            });
            data.properties = data.properties.reduce((a, v) => ({ ...a, [v.name]: v }), {})
            if (data.properties.undefined) {
                delete data.properties.undefined
            }
            classes[data.name] = data;
            // next(context.querySelector("div.ml16.mb16"), { class: data.name });
            next(context, { class: data.name });
        })
        .find("div.ml16.mb16 > div")
        .set({
            member: "h3",
            name: "node() !> div@id", // gets the id of parent div.element (!> is parent)
            doc: "p:first",
            args: [
                osmosis
                    .find("tr")
                    .set({
                        name: "span.docs-attribute-name",
                        type: "span.docs-attribute-type:first",
                        doc: "div.docs-attribute-description",
                    })
            ]
        })
        .data(data => {
            // console.log('DAT', data)
            if (classes[data.class].properties[data.name]) {
                if (data.doc) {
                    classes[data.class].properties[data.name].short = classes[data.class].properties[data.name].doc
                    classes[data.class].properties[data.name].doc = data.doc.replace(/\n */g, " ")
                }
                classes[data.class].properties[data.name].member = data.member.replace(/\n */g, " ")

                if (classes[data.class].properties[data.name].member.includes('(')) {
                    classes[data.class].properties[data.name].type = 'function'
                    classes[data.class].properties[data.name].returns = 'null'
                }
                data.args.forEach((arg, i) => {
                    if (arg.doc) {
                        arg.doc = arg.doc.replace(/\n */g, " ")
                    }
                    if (arg.type) {
                        arg.type = arg.type.replace(/:: /, '')
                    }
                });
                let args = data.args.reduce((a, v) => ({ ...a, [v.name]: v }), {})
                if (args.undefined) {
                    if (args.undefined.type) {
                        classes[data.class].properties[data.name].returns = args.undefined.type.replace(/→./, '').replace(/\?$/, '')
                        if (args.undefined.doc) {
                            classes[data.class].properties[data.name].doc += " Returns: " + args.undefined.doc
                        } else {
                            console.log(data.name, args.undefined)
                        }
                    }
                    delete args.undefined
                }
                if (Object.keys(args).length != 0) {
                    classes[data.class].properties[data.name].args = args
                }
            } else {
                console.log('???', data)
            }
        })
        .done(function () {
            saveData('./api/' + clazz + '.json', classes)
            // check(clazz)
            // console.log(JSON.stringify(classes, null, 2));
        })
        .log(data => console.log('LOG', data))
        .error(data => console.log('ERR', data))
}

function check(name) {
    readData('./api/classesOrig.json').then(orig => {
        console.log('DIFF', JSON.stringify(diff(orig[name], classes[name], ['doc', 'short', 'member']), null, 2))
    })
}

function diff(obj1, obj2, ignore) {
    ignore = ignore || []
    const result = {};
    if (Object.is(obj1, obj2)) {
        return undefined;
    }
    if (!obj2 || typeof obj2 !== 'object') {
        return obj2;
    }
    Object.keys(obj1 || {}).concat(Object.keys(obj2 || {})).filter(key => !ignore.includes(key)).forEach(key => {
        if (obj2[key] !== obj1[key] && !Object.is(obj1[key], obj2[key])) {
            result[key] = obj2[key];
        }
        if (typeof obj2[key] === 'object' && typeof obj1[key] === 'object') {
            const value = diff(obj1[key], obj2[key], ignore);
            if (value !== undefined) {
                result[key] = value;
            }
        }
    });
    return result;
}

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

// Osmosis example code
function xmp() {
    // global settings
    osmosis.config('user_agent', 'Osmosis')
    osmosis.config({
        follow: 0,      // number of redirects to follow
        tries: 2,       // number of retries
        concurrency: 5, // number of concurrent requests
        proxies: ['localhost:1081', 'localhost:1082']
    })

    osmosis
        .get('https://really-verbose-examples.com', { page: 1 }) // query params ?page=1
        .config('proxy', '192.168.9.1:1080') // per request settings
        .post('/admin-login', { postUser: 'me', postPass: 'secret', rememberMe: true })
        .config({
            username: 'Basic Auth username',
            password: 'Basic Auth password'
        })
        .error((err) => console.log(`Login Error ${err}`))
        .submit('.updateForm:last') // submit a form using default HTML values
        .select('.formResults')     // change the current context
        .set('resultStatus', '> h2.status + p')
        .find('#page-forms')
        .submit('form:after(form.login):not(:has(span:contains("some text")))', { // submit a form and set some values
            title: 'New Thing',
            lastStatus: (context, data) => data.resultStatus,
            id: id => parseInt(id.getAttribute('value')) + 1
        })
        .then((document, data, next) => {
            var success = document.querySelector('div:contains("Success")');
            if (success) {
                data.lastStatus = success.querySelector('~ div:skip(2):has(h2:first-child) !+ text():ends-with(" Code")').innerHTML;
                next(document, data);
            } else {
                this.error('Form failed! Error: ' + document.querySelector('.errMessage !> div@data-error'))
            }
        })
        .follow('#nav a[href^="/site/"]:starts-with("Search ")')
        .if('div.must-authorize:not(:empty)')
        .login('me@overly-complex-site.com', 'abc123')
        .success('.success:contains("you\'re in!")')
        .fail('div:istarts-with("incorrect")')
        .set({
            results: [
                osmosis.find('#results > li')
                    .set('id', '@resultId')
                    .filter(':not(.banner-ad)')
                    .then((context, data, next, done) => {
                        database.checkId(data.id, function (exists) {
                            if (!exists) {
                                next(context, data);
                                done();
                            }
                        })
                    })
                    .set({
                        'title': 'h3',
                        'content': '.container',
                        'link': 'a:first@href',
                        'tags': ['.tags > span'],
                        'images': [
                            osmosis.find('img')
                                .set({
                                    'url': '@src',
                                    'width': img => parseInt(img.getAttribute('width')),
                                    'height': img => parseInt(img.getAttribute('height')),
                                    'data': osmosis.follow('@src')
                                })
                        ],
                        'externalSite':
                            osmosis.follow('a:external')
                                .set({
                                    'pageTitle': 'title',
                                    'email': osmosis.find('a:mailto@href').replace(/^mailto\:/, '')
                                })
                                .data((doc, data) => { if (data.email) console.log("Got email:", data.email) })
                    })
            ],
            resultCount: (context, data) => data.results.length
        })
        .data((data) => {
            /* data = {
                resultStatus: "...",
                lastStatus: "...",
                results: [
                    {
                        title:      "...",
                        content:    "...",
                        link:       "...",
                        tags:       [ "...", "...", ... ]
                        images: [
                            {
                                url:    "...",
                                width:  123,
                                height: 123,
                                data:   Buffer
                            }
                        ],
                        externalSite: {
                            pageTitle:  "...",
                            email:      "user@example.com"
                        }
                    },
                    ...
                ],
                resultCount: 123,
            }
            */
        })
        .log(console.log)
        .error(console.error)
        .debug(console.error);
}
