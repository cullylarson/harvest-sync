"use strict"

let Promise = require("promise")
let dailyRepo = require("./daily")

let buildTaskFromDailyTask = (dailyTask) => {
    return {
        id: parseInt(dailyTask.id),
        name: dailyTask.name,
    }
}

let TaskRepo
module.exports = TaskRepo = {
    getTasks: (harvest) => {
        let foundTasks = {}

        return dailyRepo.reduceProjects(harvest, [], (tasks, project) => {
            if(!project.tasks || !project.tasks.length) return tasks

            project.tasks.forEach((taskData) => {
                let task = buildTaskFromDailyTask(taskData)
                // already have it
                if(foundTasks[task.id]) return

                foundTasks[task.id] = true

                tasks.push(task)
            })

            return tasks
        })
    },

    getTaskByName: (harvest, name) => {
        return TaskRepo.getTasks(harvest)
            .then(function(tasks) {
                let nameLower = name.toLowerCase()
                for(let i = 0; i < tasks.length; i++) {
                    if(tasks[i].name.toLowerCase() === nameLower) return Promise.resolve(tasks[i])
                }

                return Promise.resolve(null)
            })
    },

    getProjectTasks: (harvest, projectId) => {
        return dailyRepo.reduceProjects(harvest, [], (tasks, project) => {
            if(project.id != projectId) return tasks
            if(!project.tasks || !project.tasks.length) return tasks

            project.tasks.forEach((taskData) => {
                let task = buildTaskFromDailyTask(taskData)

                tasks.push(task)
            })

            return tasks
        })
    }
}
