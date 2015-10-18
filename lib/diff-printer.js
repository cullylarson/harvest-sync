"use strict"

let chalk = require("chalk")
let sortObj = require("sort-object")
let undatle = require("./undatle")
let datle = require("./datle")
let moment = require("moment")

module.exports = (diffs) => {
    let formatLine = (marker, detailFn, diff) => {
        return "[" + marker + "] " + detailFn(diff.source.client.name + " / " + diff.source.project.name + " / " + diff.source.task.name + " (" + hoursFloatToStr(diff.time.hours) + ")")
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

function hoursFloatToStr(hoursFloat) {
    let hoursInt = Math.floor(hoursFloat)
    let minsFloat = hoursFloat - hoursInt
    let minsInt = Math.floor(minsFloat * 60)

    return "" + hoursInt + ":" + ("0" + minsInt).slice(-2)
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