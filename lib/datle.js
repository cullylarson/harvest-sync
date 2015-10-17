"use strict"

module.exports = function(dateStr) {
    let matches = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if(!matches) return null
    else return new Date(matches[1], matches[2]-1, matches[3])
}