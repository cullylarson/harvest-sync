"use strict"

let Promise = require("promise")

let buildProjectFromHarvest = function(harvestData) {
    return {
        id: parseInt(harvestData.project.id),
        clientId: parseInt(harvestData.project.client_id),
        name: harvestData.project.name,
    }
}

let ProjectRepo
module.exports = ProjectRepo = {
    getProjects : function (harvest) {
        return new Promise(function (resolve, reject) {
            harvest.Projects.list({}, function(err, data) {
                if(err) reject(err)
                else resolve(data)
            })
        })
    },

    getClientProjectByName: function(harvest, clientId, projectName) {
        return ProjectRepo.getProjects(harvest)
            .then(function(projects) {
                for(let key in projects) {
                    if(!projects.hasOwnProperty(key)) continue;

                    let project = buildProjectFromHarvest(projects[key])

                    if(project.name === projectName && project.clientId === clientId) {
                        return Promise.resolve(project)
                    }
                }

                return Promise.resolve(null)
            })
    }
}