"use strict"

let Promise = require("promise")
let dailyRepo = require("./daily")

let buildProjectFromDailyProject = (dailyProject) => {
    return {
        id: parseInt(dailyProject.id),
        clientId: parseInt(dailyProject.client_id),
        name: dailyProject.name,
    }
}

let ProjectRepo
module.exports = ProjectRepo = {
    getProjects: (harvest) => {
        let foundProjects = {}

        return dailyRepo.reduceProjects(harvest, [], (projects, harvestProject) => {
            let project = buildProjectFromDailyProject(harvestProject)
            // already found it
            if(foundProjects[project.id]) return projects

            foundProjects[project.id] = true

            projects.push(project)

            return projects
        })
    },

    getClientProjectByName: (harvest, clientId, projectName) => {
        return ProjectRepo.getProjects(harvest)
            .then(function(projects) {
                let nameLower = projectName.toLowerCase()
                for(let i = 0; i < projects.length; i++) {
                    if(projects[i].clientId === clientId, projects[i].name.toLowerCase() === nameLower) return Promise.resolve(projects[i])
                }

                return Promise.resolve(null)
            })
    },
}
