"use strict"

let Promise = require("promise")

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
    }
}