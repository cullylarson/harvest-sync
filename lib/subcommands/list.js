"use strict"

let harvestUtil = require("../harvest-util")
let projectRepo = require("../repository/project")
let clientRepo = require("../repository/client")
let taskRepo = require("../repository/task")
let readConfig = require("../config-reader")
let Spinner = require("cli-spinner").Spinner
let chalk = require("chalk")
let escapeName = require("../sync-value-escape")

module.exports = (listDefStr, configFilename) => {
    let config = readConfig(configFilename)
    let harvest
    let listDef = splitListDef(listDefStr)

    if(listDef.machine === "dest") harvest = harvestUtil.getHarvestDest(config)
    else harvest = harvestUtil.getHarvestSource(config)

    let spinnerSearching = new Spinner(chalk.magenta("Searching Harvest..."))
    spinnerSearching.setSpinnerString(7)
    spinnerSearching.start()

    getClientItems(harvest)
        .then((clientResults) => {
            if(listDef.list === "projects" || listDef.list === "tasks") return getClientProjectItems(harvest, clientResults)
            else return Promise.resolve(clientResults)
        })
        .then((projectResults) => {
            if(listDef.list === "tasks") return getProjectTaskItems(harvest, projectResults)
            else return Promise.resolve(projectResults)
        })
        .then((results) => {
            spinnerSearching.stop(true)

            printList(results)
        })
}

function printList(results) {
    results.forEach((result) => {
        console.log(buildResultStr(result))
    })
}

function buildResultStr(result) {
    let str = ""

    if(result.client) str += chalk.gray(escapeName(result.client.name))
    if(result.project) str += chalk.bold(" / ") + chalk.cyan(escapeName(result.project.name))
    if(result.task) str += chalk.bold(" / ") + chalk.magenta(escapeName(result.task.name))

    return str
}

function splitListDef(listDef) {
    let pieces = listDef.split(".")
    return {
        "machine": pieces[0],
        "list": pieces[1],
    }
}

function getClientItems(harvest) {
    return clientRepo.getClients(harvest)
        .then((clients) => {
            let results = []

            clients.forEach((client) => {
                results.push({
                    "client": client
                })
            })

            return Promise.resolve(results)
        })
}

function getClientProjectItems(harvest, clientResults) {
    let allPromises = []
    clientResults.forEach((clientResult) => {
        let thisPromise = projectRepo.getClientProjects(harvest, clientResult.client.id)
            .then((projects) => {
                let results = []

                projects.forEach((project) => {
                    results.push({
                        "client": clientResult.client,
                        "project": project
                    })
                })

                return Promise.resolve(results)
            })

        allPromises.push(thisPromise)
    })

    return Promise.all(allPromises)
        .then((resultsComplex) => {
            return Promise.resolve(resultsComplex.reduce((resultsFlat, item) => resultsFlat.concat(item), []))
        })
}

function getProjectTaskItems(harvest, projectResults) {
    let allPromises = []
    projectResults.forEach((projectResult) => {
        let thisPromise = taskRepo.getProjectTasks(harvest, projectResult.project.id)
            .then((tasks) => {
                let results = []

                tasks.forEach((task) => {
                    results.push({
                        "client": projectResult.client,
                        "project": projectResult.project,
                        "task": task,
                    })
                })

                return Promise.resolve(results)
            })

        allPromises.push(thisPromise)
    })

    return Promise.all(allPromises)
        .then((resultsComplex) => {
            return Promise.resolve(resultsComplex.reduce((resultsFlat, item) => resultsFlat.concat(item), []))
        })
}