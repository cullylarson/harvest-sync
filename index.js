#!/usr/bin/env node --harmony
"use strict"

let Harvest = require("harvest")
let commandLineArgs = require("command-line-args")
let error = require("./lib/error")
let datle = require("./lib/datle")
let basename = require("basename")
let jsonfile = require("jsonfile")
let Promise = require("promise")
let projectRepo = require("./lib/repository/project")
let clientRepo = require("./lib/repository/client")
let taskRepo = require("./lib/repository/task")
let dailyRepo = require("./lib/repository/daily")

{
    let args = getArguments()
    let config = readConfig(args.config)
    let harvestSource = getHarvestSource(config)
    let harvestDest = getHarvestDest(config)
    let syncActions = getSyncActions(harvestSource, harvestDest, config.sync)
}

/*
 * Functions
 */

function getSyncActions(harvestSource, harvestDest, syncs) {
    getAllSyncData(harvestSource, harvestDest, syncs)
        .then((syncsData) => {
            console.log(syncsData)//stub
        })
}

function getAllSyncData(harvestSource, harvestDest, syncs) {
    return new Promise((resolve, reject) => {
        let allSyncData = []

        let allPromises = []

        for(let key in syncs) {
            if (!syncs.hasOwnProperty(key)) continue;
            let source = key
            let dest = syncs[key]

            let sourceParts = parseSyncItem(source)
            let destParts = parseSyncItem(dest)

            let sourcePromise = getHarvestData(harvestSource, "source", sourceParts)
            let destPromise = getHarvestData(harvestDest, "dest", destParts)

            let bothPromise = Promise.all([sourcePromise, destPromise])
                .then((values) => {
                    let sourceHarvestData = values[0]
                    let destHarvestData = values[1];

                    allSyncData.push({"source": sourceHarvestData, "dest": destHarvestData})
                })

            allPromises.push(bothPromise)
        }

        Promise.all(allPromises)
            .then(() => {
                resolve(allSyncData)
            })
            .catch((err) => {
                error("Something went wrong while talking to Harvest: " + err)
                process.exit(13)
            })
    })
}

function getHarvestData(harvest, harvestName, syncParts) {
    let client, project, task

    let clientProjectPromise = clientRepo.getClientByName(harvest, syncParts.client)
        .catch(function(err) {
            error("Something went wrong while fetching " + harvestName + " client from Harvest: " + err)
            process.exit(12)
        })
        .then(function(thisClient) {
            if(!thisClient) {
                error("Could not find " + harvestName + " client in Harvest: " + syncParts.client)
                process.exit(8)
            }

            client = thisClient

            return projectRepo.getClientProjectByName(harvest, thisClient.id, syncParts.project)
        })
        .catch(function(err) {
            error("Something went wrong while fetching " + harvestName + " project from Harvest: " + err)
            process.exit(12)
        })
        .then(function(thisProject) {
            if(!thisProject) {
                error("Could not find " + harvestName + " project in Harvest: " + syncParts.client + " / " + syncParts.project)
                process.exit(9)
            }

            project = thisProject

            return Promise.resolve(thisProject)
        })
        .catch(function(err) {
            error("Something went wrong while talking with Harvest: " + err)
            process.exit(7)
        })

    let taskPromise = taskRepo.getTaskByName(harvest, syncParts.task)
        .catch(function(err) {
            error("Something went wrong while  fetching " + harvestName + " task from Harvest: " + err)
            process.exit(11)
        })
        .then(function(thisTask) {
            if(!thisTask) {
                error("Could not find " + harvestName + " task in Harvest: " + syncParts.task)
                process.exit(10)
            }

            task = thisTask

            return Promise.resolve(thisTask)
        })
        .catch(function(err) {
            error("Something went wrong while talking with Harvest: " + err)
            process.exit(7)
        })

    return Promise.all([clientProjectPromise, taskPromise])
        .then((values) => {
            return Promise.resolve({
                "client" : client,
                "project" : project,
                "task" : task
            })
        })
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
        if(!sync.hasOwnProperty(key)) continue;

        let source = key
        let dest = sync[key]

        let sourceParts = parseSyncItem(source)
        let destParts = parseSyncItem(dest)

        let sourceProblem = analyzeParts("Source", source, sourceParts)
        if(sourceProblem) return sourceProblem

        let destProblem = analyzeParts("Destination", dest, destParts)
        if(destProblem) return destProblem
    }
}

/**
 * Each item should be: client / project / task
 *
 * With any backslashes in the names escaped (i.e. //).
 *
 * So, need to go through, and find the non-escape backslash
 * separators.
 *
 * @param syncStr
 */
function parseSyncItem(syncStr) {
    var findNext = function(carry, rest) {
        // no more string
        if(!rest[0]) {
            return {"carry": carry, "rest": rest}
        }
        // found an escaped slash
        else if(rest[0] === '/' && rest[1] && rest[1] === '/') {
            return findNext(carry + "/", rest.slice(2))
        }
        // found a non-escaped slash
        else if(rest[0] === '/') {
            return {"carry": carry.trim(), "rest": rest.slice(1).trim()}
        }
        // still in our current position
        else {
            return findNext(carry + rest[0], rest.slice(1))
        }
    }

    let pieces = []
    let current = {"carry": "", "rest": syncStr}

    while(current.rest) {
        if(current.carry) {
            pieces.push(current.carry)
        }

        current = findNext("", current.rest)
    }

    // push the last one
    if(current.carry) {
        pieces.push(current.carry)
    }

    return {
        "client" : pieces[0] ? pieces[0] : undefined,
        "project" : pieces[1] ? pieces[1] : undefined,
        "task" : pieces[2] ? pieces[2] : undefined,
        "overflow": pieces[3] ? pieces.slice(2).join(" / ") : undefined
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

function getHarvest(config, key) {
    let harvestConfig = config[key]

    try {
        return new Harvest({
            "subdomain": harvestConfig.subdomain,
            "email": harvestConfig.email,
            "password": harvestConfig.password
        })
    }
    catch(ex) {
        error("Could not connect to " + key + ": " + ex.message)
        process.exit(4)
    }
}

function getHarvestSource(config) {
    return getHarvest(config, "source")
}

function getHarvestDest(config) {
    return getHarvest(config, "dest")
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
