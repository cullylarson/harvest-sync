"use strict"

let chalk = require("chalk")

module.exports = function(msg) {
    if(!Array.isArray(msg)) msg = [msg]

    msg.forEach(x => console.error(chalk.red("ERROR: ") + x))
}