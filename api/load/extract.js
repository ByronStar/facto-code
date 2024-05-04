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
processClass('LuaAccumulatorControlBehavior')
// processClass('LuaTransportLine')
// processClass('LuaAchievementPrototyp5')
// processClasses(urls.proxy + "classes.html")
// processDefines()

function processClasses(url) {
    osmosis
        .get(url)
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

                data.args.forEach((arg, i) => {
                    if (arg.doc) {
                        arg.doc = arg.doc.replace(/\n */g, " ")
                    }
                });
                let args = data.args.reduce((a, v) => ({ ...a, [v.name]: v }), {})
                if (args.undefined) {
                    // console.log(data.name, args.undefined)
                    if (args.undefined.type) {
                        classes[data.class].properties[data.name].returns = args.undefined.type
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

            // classes[data.name] = data;
        })
        .done(function () {
            // console.log(JSON.stringify(classes, null, 2));
            saveData('./api/classes.json', classes)
        })
        // .data(data => console.log('DAT', data))
        .log(data => console.log('LOG', data))
        .error(data => console.log('ERR', data))
}

function processDefines() {
    osmosis
        .get((urls.localPy + "defines.html"))
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
            processEvents()
            // saveData('./api/defines.json', defines)
        })
        .log(data => console.log('LOG', data))
        .error(data => console.log('ERR', data))
}

function processEvents() {
    osmosis
        .get((urls.localPy + "events.html"))
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
            console.log("events page: ", data);
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
            saveData('./api/defines.json', defines)
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
            classes[data.class].properties[data.name].short = classes[data.class].properties[data.name].doc
            if (data.doc) {
                classes[data.class].properties[data.name].doc = data.doc.replace(/\n */g, " ")
            }
            classes[data.class].properties[data.name].member = data.member.replace(/\n */g, " ")

            if (classes[data.class].properties[data.name].member.includes('(')) {
                classes[data.class].properties[data.name].type = 'function'
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
                    classes[data.class].properties[data.name].returns = args.undefined.type
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

            // classes[data.name] = data;
        })
        .done(function () {
            saveData('./api/' + clazz + '.json', classes)
            check(clazz)
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
