"use strict"

let Promise = require("promise")

let buildTaskFromHarvest = function(harvestData) {
    return {
        id: parseInt(harvestData.task.id),
        name: harvestData.task.name,
    }
}

let TaskRepo
module.exports = TaskRepo = {
    getTasks: function(harvest) {
        return new Promise(function (resolve, reject) {
            harvest.Tasks.list({}, function(err, data) {
                if(err) reject(err)
                else resolve(data)
            })
        })
    },

    getTaskByName: function(harvest, taskName) {
        return TaskRepo.getTasks(harvest)
            .then(function(tasks) {
                for(let key in tasks) {
                    if(!tasks.hasOwnProperty(key)) continue;

                    let task = buildTaskFromHarvest(tasks[key])

                    if(task.name === taskName) {
                        return Promise.resolve(task)
                    }
                }

                return Promise.resolve(null)
            })
    },
}