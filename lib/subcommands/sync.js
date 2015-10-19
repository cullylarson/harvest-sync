"use strict"

let datle = require("../datle")
let actionUtil = require("../action-util")
let harvestUtil = require("../harvest-util")
let actionPrinter = require("../action-printer")
let confirmActions = require("../confirm-actions")
let chalk = require("chalk")
let Spinner = require("cli-spinner").Spinner
let readConfig = require("../config-reader")

module.exports = (configFilename) => {
    let config = readConfig(configFilename)
    let harvestSource = harvestUtil.getHarvestSource(config)
    let harvestDest = harvestUtil.getHarvestDest(config)

    let spinnerSearching = new Spinner(chalk.magenta("Searching Harvest..."))
    spinnerSearching.setSpinnerString(7)

    let spinnerDoing = new Spinner(chalk.magenta("Syncing times..."))
    spinnerDoing.setSpinnerString(7)

    spinnerSearching.start()

    actionUtil.getSyncActions(harvestSource, harvestDest, datle(config.start), config.sync)
        .then((actions) => {
            spinnerSearching.stop(true)

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
            spinnerDoing.start()
            return actionUtil.performSyncActions(harvestDest, actions.missing)
        }, () => {
            console.log(chalk.bold.cyan("Exiting without performing sync.\n"))
            process.exit(0)
        })
        .then((results) => {
            spinnerDoing.stop(true)

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

