"use strict"

let Promise = require("promise")
let datle = require("../datle")
let nextday = require("nextday")

let buildTimeFromHarvestEntry = (entry) => {
    return {
        id: parseInt(entry.id),
        projectId: parseInt(entry.project_id),
        taskId: parseInt(entry.task_id),
        notes: entry.notes,
        hours: parseFloat(entry.hours),
        date: datle(entry.spent_at),
    }
}

let DailyRepo
module.exports = DailyRepo = {
    /**
     * Performs a reduce on the 'projects' array from /daily.
     *
     * @param harvest
     * @param initialCarry
     * @param cb
     * @returns Promise
     */
    reduceProjects: (harvest, initialCarry, cb) => {
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
    },

    reduceDayEntries: (harvest, date, initialCarry, cb) => {
        return new Promise(function (resolve, reject) {
            harvest.TimeTracking.daily({"date": date}, function(err, data) {
                if(err) {
                    reject(err)
                }
                else {
                    if(!data.day_entries || !data.day_entries.length) resolve(initialCarry)

                    let result = data.day_entries.reduce(cb, initialCarry)

                    resolve(result)
                }
            })
        })
    },

    getDayTimes: (harvest, date) => {
        return DailyRepo.reduceDayEntries(harvest, date, [], (times, entry) => {
            let time = buildTimeFromHarvestEntry(entry)

            times.push(time)

            return times;
        })
    },

    getPeriodTimes: (harvest, startDate, endDate) => {
        let allPromises = []

        endDate = endDate || new Date() // today
        let currentDate = new Date(startDate.getTime())
        let endTime = endDate.getTime()

        while(currentDate.getTime() <= endTime) {
            allPromises.push(DailyRepo.getDayTimes(harvest, currentDate))

            // next day
            currentDate = nextday(currentDate)
        }

        return Promise.all(allPromises)
            .then((values) => {
                return Promise.resolve(values.reduce((times, day) => {
                    day.forEach((time) => times.push(time))
                    return times
                }, []))
            })
    },
}