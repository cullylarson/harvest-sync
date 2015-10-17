"use strict"

let Promise = require("promise")

let buildClientFromDailyProject = (dailyProject) => {
    return {
        id: parseInt(dailyProject.client_id),
        name: dailyProject.client,
    }
}

let reduceDailyProjects = (harvest, initialCarry, cb) => {
    return new Promise(function (resolve, reject) {
        harvest.TimeTracking.daily({}, function(err, data) {
            if(err) {
                reject(err)
            }
            else {
                if(!data.projects || !data.projects.length) resolve(initialCarry)

                let result = data.projects.reduce(cb, initialCarry)

                resolve(result)
            }
        })
    })
}

let ClientRepo
module.exports = ClientRepo = {
    getClients: (harvest) => {
        let foundClients = {}

        return reduceDailyProjects(harvest, [], (clients, project) => {
            // no client id
            if(!project.client_id) return clients;
            // already found it
            if(foundClients[project.client_id]) return clients;

            foundClients[project.client_id] = true

            clients.push(buildClientFromDailyProject(project));

            return clients;
        })
    },

    getClientByName: (harvest, name) => {
        return ClientRepo.getClients(harvest)
            .then(function(clients) {
                for(let i = 0; i < clients.length; i++) {
                    if(clients[i].name === name) return Promise.resolve(clients[i])
                }

                return Promise.resolve(null)
            })
    },
}