"use strict"

let Harvest = require("harvest")

module.exports = {
    getHarvestSource: (config) => {
        return getHarvest(config, "source")
    },

    getHarvestDest: (config) => {
        return getHarvest(config, "dest")
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