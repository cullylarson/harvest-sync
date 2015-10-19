"use strict"

let Promise = require("promise")
let prompt = require("prompt")
let chalk = require("chalk")
let jsonfile = require("jsonfile")

module.exports = () => {
    console.log("")
    console.log(chalk.bold.cyan("BUILD CONFIG FILE:"))
    console.log(chalk.gray("============================================================================="))
    console.log(chalk.magenta("  Don't worry if you make a mistake, you can always edit the file and fix it!"))
    console.log("")
    askForInitialValues()
        // initial values
        .then((result) => {
            return Promise.resolve({
                "configFilename": result.configFilename,
                "config": {
                    "source": {
                        "subdomain": undefined,
                        "username": undefined,
                        "password": undefined,
                    },
                    "dest": {
                        "subdomain": undefined,
                        "username": undefined,
                        "password": undefined,
                    },
                    "start": result.start,
                    "sync": {}
                }
            })
        })
        // source account
        .then((params) => {
            console.log("")
            console.log(chalk.bold.cyan("SOURCE HARVEST ACCOUNT:"))
            return askForAccountParams("Source")
                .then((sourceParams) => {
                    params.config.source = sourceParams

                    return Promise.resolve(params)
                })
        })
        // dest account
        .then((params) => {
            console.log("")
            console.log(chalk.bold.cyan("DESTINATION HARVEST ACCOUNT:"))
            return askForAccountParams("Dest")
                .then((destParams) => {
                    params.config.dest = destParams

                    return Promise.resolve(params)
                })
        })
        // sync values
        .then((params) => {
            return askIfMoreSyncsLoop(params)
        })
        .then((params) => {
            return new Promise((resolve, reject) => {
                jsonfile.writeFile(params.configFilename, params.config, {spaces: 4}, (err) => {
                    if(err) reject([params, err])
                    else resolve(params)
                })
            })
        })
        .then((params) => {
            console.log("")
            console.log(chalk.green("Nice! Wrote your config file to: " + params.configFilename))
            console.log("")
        }, (x) => {
            let params = x[0]
            let err = x[1]

            console.log("")
            console.log(chalk.red("Lame! Something went wrong while writing your config file (" + params.configFilename + ")") + ":" + err)
            console.log("")
        })
}

function askIfMoreSyncsLoop(params, i) {
    i = i || 1

    return new Promise((resolve, reject) => {
        console.log("")
        console.log(chalk.bold.cyan("(" + i + ") SOURCE SYNC PARAMS:"))
        askForSyncParams("Source")
            .then((sourceSyncParams) => {
                return Promise.resolve([params, sourceSyncParams])
            })
            .then((vals) => {
                let params = vals[0]
                let sourceSyncParams = vals[1]

                console.log("")
                console.log(chalk.bold.cyan("(" + i + ") DESTINATION SYNC PARAMS:"))
                return askForSyncParams("Dest")
                    .then((destSyncParams) => {
                        params.config.sync[buildSyncString(sourceSyncParams)] = buildSyncString(destSyncParams)

                        return Promise.resolve(params)
                    })
            })
            .then((params) => {
                console.log("")
                return askIfMoreSyncs()
                    .then(() => {
                            return askIfMoreSyncsLoop(params, i+1)
                        }, () => {
                            resolve(params)
                        }
                    )
                    .then((params) => {
                        resolve(params)
                    })
            })
    })
}

function buildSyncString(syncParams) {
    return escapeSyncValue(syncParams.client) + " / " + escapeSyncValue(syncParams.project) + " / " + escapeSyncValue(syncParams.task)
}

function escapeSyncValue(value) {
    return value.replace("/", "//")
}

function askIfMoreSyncs() {
    return new Promise((resolve, reject) => {
        let schema = {
            properties: {
                confirmed: {
                    type: "string",
                    description: "Do you want to add another sync line (Yes/No)?",
                    pattern: /^yes|no|y|n$/i,
                    message: "Please enter Yes or No.",
                    required: true
                }
            }
        }

        prompt.start()

        prompt.get(schema, (err, result) => {
            let conf = result.confirmed.toLowerCase()

            if(err)                 reject()
            else if(conf === "yes") resolve()
            else if(conf === "y")   resolve()
            else                    reject()
        })
    })
}

function askForSyncParams(title) {
    return new Promise((resolve, reject) => {
        let schema = {
            properties: {
                client: {
                    type: "string",
                    description: title + " / Client Name",
                    required: true
                },
                project: {
                    type: "string",
                    description: title + " / Project Name",
                    required: true
                },
                task: {
                    type: "string",
                    description: title + " / Task Name",
                    required: true
                }
            }
        }

        prompt.start()

        prompt.get(schema, (err, params) => {
            if(err) reject()
            else resolve(params)
        })
    })
}

function askForInitialValues() {
    let startConform = (start) => {
        // not YYYY-MM-DD
        if(!start.match(/\d{4}-\d{2}-\d{2}/)) return false
        // not a valid date
        if(isNaN(Date.parse(start))) return false

        return true
    }

    return new Promise((resolve, reject) => {
        let schema = {
            properties: {
                configFilename: {
                    type: "string",
                    description: "Config filename (should end in .json)",
                    required: true
                },
                start: {
                    type: "string",
                    description: "First date to looking for time-sheets (YYYY-MM-DD)",
                    required: true,
                    message: "Date must be a valid date in the format: YYYY-MM-DD",
                    conform: startConform,
                },
            }
        }

        prompt.start()

        prompt.get(schema, (err, params) => {
            if(err) reject()
            else resolve(params)
        })
    })
}

function askForAccountParams(title) {
    let conformSubdomain = (subdomain) => {
        // no http(s)
        if(subdomain.match(/https?/i)) return false
        // no colons
        if(subdomain.match(/:/)) return false
        // no slashes
        if(subdomain.match(/\//)) return false
        // at least one period
        if(!subdomain.match(/\./)) return false

        return true
    }

    let conformEmail = (email) => {
        // exactly 1 @
        if(!email.match(/^.*?@.*?/)) return false

        return true;
    }

    return new Promise((resolve, reject) => {
        let schema = {
            properties: {
                subdomain: {
                    type: "string",
                    description: title + " / Subdomain",
                    required: true,
                    message: "Subdomain cannot contain https://, or any slashes",
                    conform: conformSubdomain
                },
                email: {
                    type: "string",
                    description: title + " / Email",
                    required: true,
                    message: "It must have one @",
                    conform: conformEmail,
                },
                password: {
                    type: "string",
                    description: title + " / Password",
                    required: true,
                    hidden: true
                },
            }
        }

        prompt.start()

        prompt.get(schema, (err, params) => {
            if(err) reject()
            else resolve(params)
        })
    })
}
