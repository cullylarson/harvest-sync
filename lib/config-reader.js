"use strict"

let actionUtil = require("./action-util")
let jsonfile = require("jsonfile")
let error = require("./error")

module.exports = (configFilename) => {
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