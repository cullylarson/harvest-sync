"use strict"

let Promise = require("promise")
let nextday = require("nextday")
let moment = require("moment")
let projectRepo = require("./repository/project")
let clientRepo = require("./repository/client")
let taskRepo = require("./repository/task")
let dailyRepo = require("./repository/daily")

let ActionUtil

module.exports = ActionUtil = {
    getSyncActions: (harvestSource, harvestDest, startDate, syncs) => {
        return getAllSyncData(harvestSource, harvestDest, syncs)
            .then((syncsData) => {
                let allPromises = []

                syncsData.forEach((sync) => {
                    allPromises.push(getSyncActions(harvestSource, harvestDest, sync, startDate))
                })

                return Promise.all(allPromises)
                    .then((actionsSet) => {
                        return Promise.resolve(reduceActionsSet(actionsSet))
                    })
            })
    },

    performSyncActions: (harvestDest, actions) => {
        let allPromises = []
        actions.forEach((action) => {
            allPromises.push(performAction(harvestDest, action))
        })

        return Promise.all(allPromises)
            .then((resultsSet) => {
                return Promise.resolve(resultsSet.reduce((results, result) => {
                    if(result.success) results.success.push(result.action)
                    else               results.failure.push(result.action)

                    return results
                }, {"success": [], "failure": []}))
            })
    },

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
    parseSyncItem: (syncStr) => {
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
}

function performAction(harvestDest, action) {
    return new Promise((resolve, reject) => {
        let destTime = {
            notes: action.time.notes,
            hours: action.time.hours,
            projectId: action.dest.project.id,
            taskId: action.dest.task.id,
            date: action.time.date
        }

        dailyRepo.addTime(harvestDest, destTime)
            .then(() => {
                resolve({
                    "failure": false,
                    "success": true,
                    "action": action,
                })
            }, (err) => {
                console.log(err)
                resolve({
                    "failure": true,
                    "success": false,
                    "action": action,
                })
            })
    })
}

function getAllSyncData(harvestSource, harvestDest, syncs) {
    return new Promise((resolve, reject) => {
        let allSyncData = []

        let allPromises = []

        for(let key in syncs) {
            if (!syncs.hasOwnProperty(key)) continue
            let source = key
            let dest = syncs[key]

            let sourceParts = ActionUtil.parseSyncItem(source)
            let destParts = ActionUtil.parseSyncItem(dest)

            let sourcePromise = getOneSyncData(harvestSource, "source", sourceParts)
            let destPromise = getOneSyncData(harvestDest, "dest", destParts)

            let bothPromise = Promise.all([sourcePromise, destPromise])
                .then((values) => {
                    let sourceHarvestData = values[0]
                    let destHarvestData = values[1]

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

function getOneSyncData(harvest, harvestName, syncParts) {
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
        .then(() => {
            return Promise.resolve({
                "client" : client,
                "project" : project,
                "task" : task
            })
        })
}

function getSyncActions(harvestSource, harvestDest, syncsData, startDate) {
    return new Promise((resolve, reject) => {
        let allPromises = []

        let current = new Date(startDate.getTime())
        let endTime = moment().endOf("day").toDate().getTime() // end of the day

        while(current.getTime() <= endTime) {
            let sourcePromise = dailyRepo.getDayTimes(harvestSource, current)
            let destPromise = dailyRepo.getDayTimes(harvestDest, current)

            current = nextday(current)

            let bothPromise = Promise.all([sourcePromise, destPromise])
                .then((values) => {
                    let sourceTimes = values[0]
                    let destTimes = values[1]

                    let actions = getActions(sourceTimes, destTimes, syncsData.source, syncsData.dest)

                    return Promise.resolve(actions)
                })

            allPromises.push(bothPromise)
        }

        Promise.all(allPromises)
            .then((actionsSet) => resolve(reduceActionsSet(actionsSet)))
    })
}

function reduceActionsSet(actionsSet) {
    return actionsSet.reduce((actions, action) => {
        return {
            "missing": actions.missing.concat(action.missing),
            "present": actions.present.concat(action.present),
        }
    }, {"missing": [], "present": []})
}

function getActions(sourceTimes, destTimes, sourceInfo, destInfo) {
    let actions = {
        "missing": [],
        "present": [],
    }

    let destTimesAlreadyFound = {}

    // find the source items that aren't in the dest
    sourceTimes.forEach((sourceTime) => {
        // if we aren't looking for this time
        if(sourceTime.projectId !== sourceInfo.project.id) return
        if(sourceTime.taskId !== sourceInfo.task.id) return

        // see if it's in the dest
        let sourceTimeAlreadyExistInDest = false

        for(let i = 0; i < destTimes.length; i++) {
            let destTime = destTimes[i]
            // if this dest time has already been paired with a source time
            if(destTimesAlreadyFound[destTime.id]) continue

            // if we aren't looking for this time
            if(destTime.projectId !== destInfo.project.id) continue
            if(destTime.taskId !== destInfo.task.id) continue

            // at this point, we know we have a source time we're looking for
            // and a dest time we're looking for.  all that's left is to compare
            // their hours to see if they're the same

            if(destTime.hours === sourceTime.hours) {
                destTimesAlreadyFound[destTime.id] = true
                sourceTimeAlreadyExistInDest = true
                break
            }
        }

        // we found this source time in dest
        if(sourceTimeAlreadyExistInDest) {
            actions.present.push(buildAction(sourceTime, sourceInfo, destInfo))
        }
        // we didn't find the source time in the dest
        else {
            actions.missing.push(buildAction(sourceTime, sourceInfo, destInfo))
        }
    })

    return actions
}

function buildAction(time, source, dest) {
    return {
        "time": time,
        "source": source,
        "dest": dest
    }
}
