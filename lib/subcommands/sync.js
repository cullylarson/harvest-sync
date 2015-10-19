"use strict"

let datle = require("../datle")
let jsonfile = require("jsonfile")
let actionUtil = require("../action-util")
let harvestUtil = require("../harvest-util")
let actionPrinter = require("../action-printer")
let confirmActions = require("../confirm-actions")
let chalk = require("chalk")

module.exports = (configFilename) => {
    let config = readConfig(configFilename)
    let harvestSource = harvestUtil.getHarvestSource(config)
    let harvestDest = harvestUtil.getHarvestDest(config)

    actionUtil.getSyncActions(harvestSource, harvestDest, datle(config.start), config.sync)
        .then((actions) => {
            actionPrinter.summary(actions)

            // no actions to perform
            if(!actions.missing.length) {
                console.log(chalk.bold.cyan("Everything is already synced. No actions to perform.\n"))
                process.exit(0)
            }
            // confirm performance of actions
            else {
                return confirmActions(actions)
            }
        })
        .then((actions) => {
            return actionUtil.performSyncActions(harvestDest, actions.missing)
        }, () => {
            console.log(chalk.bold.cyan("Exiting without performing sync.\n"))
            process.exit(0)
        })
        .then((results) => {
            // no actions performed
            if(!results.success.length && !results.failure.length) {
                console.log(chalk.bold.yellow("No changes were made.\n"))
                process.exit(0)
            }
            // all successful
            else if(!results.failure.length) {
                console.log(chalk.bold.green("All times were sent to the destination successfully.\n"))
                process.exit(0)
            }
            // else, some failure
            else {
                actionPrinter.failure({"missing": results.failure, "present": []})
            }
        })
}

function readConfig(configFilename) {
    let config
    try {
        config = jsonfile.readFileSync(configFilename)
    }
    catch(ex) {
        error(ex.message)
        process.exit(2)
    }

    verifyConfig(config)

    return config
}

function analyzeConfig(config) {
    if(!config.source) return "Your config must define: source"
    if(!config.dest) return "Your config must define: dest"
    if(!config.source.subdomain) return "Your config must define: source.subdomain"
    if(!config.source.email) return "Your config must define: source.email"
    if(!config.source.password) return "Your config must define: source.password"
    if(!config.dest.subdomain) return "Your config must define: dest.subdomain"
    if(!config.dest.email) return "Your config must define: dest.email"
    if(!config.dest.password) return "Your config must define: dest.password"
    if(!config.start) return "Your config must define: start"
    if(!config.sync) return "Your config must define: sync"
    if(!Object.keys(config.sync).length) return "Your config must define at least one sync item"

    let startProblem = analyzeStart(config.start)
    if(startProblem) return startProblem

    let syncProblem = analyzeSync(config.sync)
    if(syncProblem) return syncProblem
}

function analyzeStart(start) {
    if(!start.match(/^(\d{4})-(\d{2})-(\d{2})$/)) return "'start' must be in the format: YYYY-MM-DD"

    if(isNaN(Date.parse(start))) return "The start date provided is not a valid date"
}

function analyzeSync(sync) {
    let analyzeParts = function(type, str, parts) {
        if(!parts.client) return type + " sync string [" + str + "] is missing client, project, and task"
        if(!parts.project) return type + " sync string [" + str + "] is missing project and task"
        if(!parts.task) return type + " sync string [" + str + "] is missing task"
        if(parts.overflow) return type + " sync string [" + str + "] must only contain a client, project, and task. Other pieces were found."
    }

    for(let key in sync) {
        if(!sync.hasOwnProperty(key)) continue

        let source = key
        let dest = sync[key]

        let sourceParts = actionUtil.parseSyncItem(source)
        let destParts = actionUtil.parseSyncItem(dest)

        let sourceProblem = analyzeParts("Source", source, sourceParts)
        if(sourceProblem) return sourceProblem

        let destProblem = analyzeParts("Destination", dest, destParts)
        if(destProblem) return destProblem
    }
}

function verifyConfig(config) {
    let configProblem = analyzeConfig(config)
    if(configProblem) {
        error(configProblem)
        process.exit(3)
    }
}