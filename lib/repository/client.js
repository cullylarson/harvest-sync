"use strict"

let Promise = require("promise")

let buildClientFromHarvest = function(harvestData) {
    return {
        id: parseInt(harvestData.client.id),
        name: harvestData.client.name,
    }
}

let ClientRepo
module.exports = ClientRepo = {
    getClients: function(harvest) {
        return new Promise(function (resolve, reject) {
            harvest.Clients.list({}, function(err, data) {
                if(err) reject(err)
                else resolve(data)
            })
        })
    },

    getClientByName: function(harvest, name) {
        return ClientRepo.getClients(harvest)
            .then(function(clients) {
                for(let key in clients) {
                    if(!clients.hasOwnProperty(key)) continue;

                    let client = buildClientFromHarvest(clients[key])

                    if(client.name === name) {
                        return Promise.resolve(client)
                    }
                }

                return Promise.resolve(null)
            })
    },
}