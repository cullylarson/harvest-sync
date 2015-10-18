#!/usr/bin/env node --harmony
"use strict"

// TODO -- handle promise rejection
// TODO -- move functions into modules

let commandLineArgs = require("command-line-args")
let error = require("./lib/error")
let datle = require("./lib/datle")
let basename = require("basename")
let jsonfile = require("jsonfile")
let Promise = require("promise")
let syncUtil = require("./lib/sync-util")
let harvestUtil = require("./lib/harvest-util")
let actionPrinter = require("./lib/action-printer")
let confirmActions = require("./lib/confirm-actions")

{
    let args = getArguments()
    let config = readConfig(args.config)
    let harvestSource = harvestUtil.getHarvestSource(config)
    let harvestDest = harvestUtil.getHarvestDest(config)
    syncUtil.getSyncActions(harvestSource, harvestDest, datle(config.start), config.sync)
        .then((actions) => {
            actionPrinter(actions)

            return confirmActions()
        })
        .then(() => {
            console.log("DOING STUFF, NOT REALLY")
        }, () => {
            console.log("FINE, DOING NOTHING, REALLY")
        })
}

/*
 * Functions
 */

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
        if(!sync.hasOwnProperty(key)) continue;

        let source = key
        let dest = sync[key]

        let sourceParts = syncUtil.parseSyncItem(source)
        let destParts = syncUtil.parseSyncItem(dest)

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

function verifyArguments(args, cliUsage) {
    // just want help
    if(args.help) {
        console.log(cliUsage)
        process.exit(0)
    }

    // no config file
    if(!args.config) {
        console.log(cliUsage)
        process.exit(1)
    }
}

function getArguments() {
    let me = basename(process.argv[1])

    let cli = commandLineArgs(
        [
            { name: "config", type: String, multiple: false, defaultOption: true },
            { name: "help", alias: "h", type: Boolean, defaultValue: false },
            { name: "dry-run", type: Boolean, defaultValue: false },
        ]
    )

    let cliUsage = cli.getUsage({
        title: "harvest-sync",
        description: "Syncs timesheets between two harvest accounts.",
        footer: "Project Home: [underline]{https://github.com/cullylarson/harvest-sync}",
        synopsis: [
            "$ " + me + " path/to/your-config-file.json",
            "$ " + me + " [bold]{--help}"
        ],
    })

    let args = cli.parse()

    verifyArguments(args, cliUsage)

    return args
}
