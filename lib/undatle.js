"use strict"

module.exports = function(d) {
    let year = d.getFullYear()
    let month = d.getMonth()+1
    let day = d.getDate()

    return year + "-" + ("0" + month).slice(-2) + "-" + ("0" + day).slice(-2);
}