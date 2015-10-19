"use strict"

let chalk = require("chalk")
let sortObj = require("sort-object")
let undatle = require("./undatle")
let datle = require("./datle")
let moment = require("moment")

module.exports = (actions) => {
    let actionsByDate = getActionsByDate(actions)
    console.log(chalk.bold("SUMMARY:"))
    console.log("")
    console.log("[" + chalk.bold.bgGreen("*")  + "] => " + chalk.green("Item already exists at the destination."))
    console.log("[" + chalk.bold.bgYellow("+") + "] => " + chalk.yellow("Item will be copied to the destination."))
    console.log("")
    console.log(chalk.gray("==========================================================================="))
    for(let dateStr in actionsByDate) {
        if (!actionsByDate.hasOwnProperty(dateStr)) continue;
        let iActions = actionsByDate[dateStr]
        let iDate = datle(dateStr)

        let l = []
        l.p = l.push

        l.p("")
        l.p(chalk.cyan(moment(iDate).format("ddd MMM Do")))
        l.p(chalk.gray("---------------------------------------------------------------------------"))

        iActions.present.forEach((presentAction) => {
            l.p(formatLine(chalk.bold.bgGreen("*"), chalk.green, chalk.gray, presentAction))
            l.p("")
        })

        iActions.missing.forEach((missingAction) => {
            l.p(formatLine(chalk.bold.bgYellow("+"), chalk.yellow, chalk.bold.yellow, missingAction))
            l.p("")
        })

        l.forEach((x) => console.log(x))
    }

    console.log(chalk.gray("\n==========================================================================="))
    console.log("")
}

function formatLine(marker, sourceFn, destFn, action) {
    let result =
        "[" + marker + "] " + sourceFn(action.source.client.name + " / " + action.source.project.name + " / " + action.source.task.name + " (" + action.time.hoursHuman + ")")
        + "\n    => " + destFn(action.dest.client.name + " / " + action.dest.project.name + " / " + action.dest.task.name + " (" + action.time.hoursHuman + ")")
        + "\n    " + chalk.bold("NOTES: ") + action.time.notes.replace("\n", "\n    ")

    return result
}

function getActionsByDate(actions) {
    let byDate = {}

    let ensureKey = (key) => {
        if(!byDate[key]) {
            byDate[key] = {
                "missing": [],
                "present": []
            }
        }
    }

    actions.missing.forEach((missingAction) => {
        let dateStr = undatle(missingAction.time.date)
        ensureKey(dateStr)

        byDate[dateStr].missing.push(missingAction)
    })

    actions.present.forEach((presentAction) => {
        let dateStr = undatle(presentAction.time.date)
        ensureKey(dateStr)

        byDate[dateStr].present.push(presentAction)
    })

    return sortObj(byDate)
}