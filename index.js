#!/usr/bin/env node --harmony
"use strict"

// TODO -- handle promise rejection
// TODO -- move functions into modules

let Harvest = require("harvest")
let commandLineArgs = require("command-line-args")
let error = require("./lib/error")
let datle = require("./lib/datle")
let undatle = require("./lib/undatle")
let moment = require("moment")
let basename = require("basename")
let jsonfile = require("jsonfile")
let nextday = require("nextday")
let Promise = require("promise")
let projectRepo = require("./lib/repository/project")
let clientRepo = require("./lib/repository/client")
let taskRepo = require("./lib/repository/task")
let dailyRepo = require("./lib/repository/daily")
let chalk = require("chalk")
let sortObj = require("sort-object")

{
    let args = getArguments()
    let config = readConfig(args.config)
    let harvestSource = getHarvestSource(config)
    let harvestDest = getHarvestDest(config)
    let syncActions = getSyncActions(harvestSource, harvestDest, datle(config.start), config.sync)
}

/*
 * Functions
 */

function getSyncActions(harvestSource, harvestDest, startDate, syncs) {
    getAllSyncData(harvestSource, harvestDest, syncs)
        .then((syncsData) => {
            let allPromises = []

            syncsData.forEach((sync) => {
                allPromises.push(diffDays(harvestSource, harvestDest, sync, startDate))
            })

            return Promise.all(allPromises)
        })
        .then((diffs) => {
            printDiffSummary(diffs)
        })
}

function hoursFloatToStr(hoursFloat) {
    let hoursInt = Math.floor(hoursFloat)
    let minsFloat = hoursFloat - hoursInt
    let minsInt = Math.floor(minsFloat * 60)

    return "" + hoursInt + ":" + ("0" + minsInt).slice(-2)
}

function printDiffSummary(diffs) {
    let formatLine = (marker, detailFn, diff) => {
        return "[" + marker + "] " + detailFn(diff.client.name + " / " + diff.project.name + " / " + diff.task.name + " (" + hoursFloatToStr(diff.time.hours) + ")")
    }

    let diffsByDate = getDiffsByDate(diffs)
    console.log(chalk.bold("SUMMARY:"))
    console.log(chalk.gray("==========================================================================="))
    for(let dateStr in diffsByDate) {
        if (!diffsByDate.hasOwnProperty(dateStr)) continue;
        let iDiffs = diffsByDate[dateStr]
        let iDate = datle(dateStr)

        let l = []
        l.p = l.push

        l.p("")
        l.p(chalk.cyan(moment(iDate).format("ddd MMM Do")))
        l.p(chalk.gray("---------------------------------------------------------------------------"))

        iDiffs.present.forEach((presentDiff) => {
            l.p(formatLine(chalk.bgGreen("*"), chalk.green, presentDiff))
        })

        iDiffs.missing.forEach((missingDiff) => {
            l.p(formatLine(chalk.bgYellow("+"), chalk.yellow, missingDiff))
        })

        l.forEach((x) => console.log(x))
    }

    console.log(chalk.gray("\n==========================================================================="))
}

function getDiffsByDate(diffs) {
    let byDate = {}

    let ensureKey = (key) => {
        if(!byDate[key]) {
            byDate[key] = {
                "missing": [],
                "present": []
            }
        }
    }

    diffs.forEach((diff) => {
        if(!diff.missing.length && !diff.present.length) return

        diff.missing.forEach((missingDiff) => {
            let dateStr = undatle(missingDiff.time.date)
            ensureKey(dateStr)

            byDate[dateStr].missing.push(missingDiff)
        })

        diff.present.forEach((presentDiff) => {
            let dateStr = undatle(presentDiff.time.date)
            ensureKey(dateStr)

            byDate[dateStr].present.push(presentDiff)
        })
    })

    return sortObj(byDate)
}

function diffDays(harvestSource, harvestDest, syncsData, startDate) {
    return new Promise((resolve, reject) => {
        let allPromises = []

        let current = new Date(startDate.getTime())
        let endTime = new Date().getTime()

        while(current.getTime() <= endTime) {
            let sourcePromise = dailyRepo.getDayTimes(harvestSource, current)
            let destPromise = dailyRepo.getDayTimes(harvestDest, current)

            current = nextday(current)

            let bothPromise = Promise.all([sourcePromise, destPromise])
                .then((values) => {
                    let sourceTimes = values[0]
                    let destTimes = values[1];

                    let diff = diffTimes(sourceTimes, destTimes, syncsData.source, syncsData.dest)

                    return Promise.resolve(diff)
                })

            allPromises.push(bothPromise)
        }

        Promise.all(allPromises)
            .then((diffs) => {
                resolve(diffs.reduce((allDiffs, diff) => {
                    return {
                        "missing": allDiffs.missing.concat(diff.missing),
                        "present": allDiffs.present.concat(diff.present),
                    }
                }, {"missing": [], "present": []}))
            })
    })
}

function diffTimes(sourceTimes, destTimes, sourceInfo, destInfo) {
    let diff = {
        "missing": [],
        "present": [],
    }

    // find the source items that aren't in the dest
    sourceTimes.forEach((sourceTime) => {
        // if we aren't looking for this time
        if(sourceTime.projectId !== sourceInfo.project.id) return
        if(sourceTime.taskId !== sourceInfo.task.id) return

        // see if it's in the dest
        let sourceTimeAlreadyExistInDest = false

        for(let i = 0; i < destTimes.length; i++) {
            let destTime = destTimes[i]
            // if we aren't looking for this time
            if(destTime.projectId !== destInfo.project.id) continue
            if(destTime.taskId !== destInfo.task.id) continue

            // at this point, we know we have a source time we're looking for
            // and a dest time we're looking for.  all that's left is to compare
            // their hours to see if they're the same

            if(destTime.hours === sourceTime.hours) {
                sourceTimeAlreadyExistInDest = true
                break
            }
        }

        // we found this source time in dest
        if(sourceTimeAlreadyExistInDest) {
            diff.present.push(buildDiff(sourceTime, sourceInfo))
        }
        // we didn't find the source time in the dest
        else {
            diff.missing.push(buildDiff(sourceTime, sourceInfo))
        }
    })

    return diff
}

function buildDiff(time, info) {
    return {
        "time": time,
        "client" : info.client,
        "project" : info.project,
        "task" : info.task
    }
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
