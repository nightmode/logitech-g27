var g = require('./../index.js')

g.connect(function(err) {
    g.on('changes', function(val) {
        console.log(val)
    })
})