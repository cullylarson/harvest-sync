#!/usr/bin/env node --harmony
"use strict"

let commandLineArgs = require("command-line-args")
let error = require("./lib/error")
let basename = require("basename")

let subcommandSync = require("./lib/subcommands/sync")
let subcommandConfig = require("./lib/subcommands/config")
let subcommandList = require("./lib/subcommands/list")

{
    let args = getArguments()

    if(args.subcommand === 'sync' && args.list) subcommandList(args.list, args.config)
    else if(args.subcommand === 'sync')         subcommandSync(args.config)
    else if(args.subcommand === 'config')       subcommandConfig()
}

/*
 * Functions
 */

function verifyArguments(args, cliUsage) {
    // just want help
    if(args.help) {
        console.log(cliUsage)
        process.exit(0)
    }

    // no config file
    if(args.subcommand === 'sync' && !args.config) {
        console.log(cliUsage)
        process.exit(1)
    }

    verifyListArg(args, cliUsage)
}

function verifyListArg(args, cliUsage) {
    let validListArgs = [
        "source.clients",
        "source.projects",
        "source.tasks",
        "dest.clients",
        "dest.projects",
        "dest.tasks",
    ]

    if(args.list && validListArgs.indexOf(args.list) === -1) {
        console.log(cliUsage)
        process.exit(21)
    }
}

function getArguments() {
    let me = basename(process.argv[1])

    let cli = commandLineArgs(
        [
            { name: "sync", type: String, multiple: true, defaultOption: true },
            { name: "list", type: String, multiple: false },
            { name: "help", alias: "h", type: Boolean, defaultValue: false },
        ]
    )

    let cliUsage = cli.getUsage({
        title: "harvest-sync",
        description: "Syncs time-sheets between two harvest accounts.",
        footer: "Project Home: [underline]{https://github.com/cullylarson/harvest-sync}",
        synopsis: [
            "$ " + me + " path/to/your-config-file.json",
            "$ " + me + " --list (source|dest).(clients|projects|tasks) path/to/your-config-file.json",
            "$ " + me + " [bold]{--help}",
            "$ " + me + " config"
        ],
    })

    let args = parseBareParams(cli.parse(), cliUsage)

    verifyArguments(args, cliUsage)

    return args
}

function parseBareParams(args, cliUsage) {
    let validSubCommands = [
        "sync",
        "config",
    ]

    let defaultSubCommand = 'sync'

    if(args.sync) args.bare = args.sync

    // parse the bare params
    if(args.bare) {
        // more than one
        if(args.bare.length) {
            // it's a sub-command
            if(validSubCommands.indexOf(args.bare[0]) !== -1) {
                args.subcommand = args.bare[0]

                // if there's another argument, assume it's the config
                if(args.bare.length > 1) {
                    args.config = args.bare[1]
                }
            }
            // not a sub-command
            else {
                // if there's more than one
                if(args.bare.length > 1) {
                    console.log(cliUsage)
                    process.exit(20)
                }
                // just one
                else {
                    args.subcommand = defaultSubCommand
                    args.config = args.bare[0]
                }
            }
        }
    }
    else {
        args.subcommand = defaultSubCommand
    }

    return args
}
