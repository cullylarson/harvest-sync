"use strict"

let Promise = require("promise")
let dailyRepo = require("./daily")

let buildClientFromDailyProject = (dailyProject) => {
    return {
        id: parseInt(dailyProject.client_id),
        name: dailyProject.client,
    }
}

let ClientRepo
module.exports = ClientRepo = {
    getClients: (harvest) => {
        let foundClients = {}

        return dailyRepo.reduceProjects(harvest, [], (clients, project) => {
            // no client id
            if(!project.client_id) return clients
            // already found it
            if(foundClients[project.client_id]) return clients

            foundClients[project.client_id] = true

            clients.push(buildClientFromDailyProject(project))

            return clients
        })
    },

    getClientByName: (harvest, name) => {
        return ClientRepo.getClients(harvest)
            .then(function(clients) {
                let nameLower = name.toLowerCase()
                for(let i = 0; i < clients.length; i++) {
                    if(clients[i].name.toLowerCase() === nameLower) return Promise.resolve(clients[i])
                }

                return Promise.resolve(null)
            })
    },
}
