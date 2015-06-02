'use strict'

//----------
// Includes
//----------
var events = require('events')
var hid = require('node-hid')

//-----------
// Variables
//-----------
var dataPrev = Array(11)
var device = ''
var eventEmitter = new events.EventEmitter()
var ledPrev = []
var memoryPrev = {
    'wheel': {
        'turn': 50,
        'shift_left' : 0,
        'shift_right': 0,
        'button_1': 0,
        // button 2 data is mixed with wheel turn data and not isolatable
        // button 3 data is mixed with wheel turn data and not isolatable
        'button_4': 0,
        'button_5': 0,
        'button_6': 0
    },
    'shifter': {
        'button_1': 0,
        'button_2': 0,
        'button_3': 0,
        'button_4': 0,
        'dpad': 0,
        'button_5': 0,
        'button_6': 0,
        'button_7': 0,
        'button_8': 0,
        'gear': 0
    },
    'pedals': {
        'gas'   : 0,
        'brake' : 0,
        'clutch': 0
    }
}
var options = {
    'autocenter': true,
    'debug': false,
    'range': 900
}

//-----------
// Functions
//-----------
function clone(obj) {
    if (obj === null || typeof obj !== 'object') {
        return obj
    }

    var temp = obj.constructor()

    for (var key in obj) {
        temp[key] = clone(obj[key])
    }

    return temp
} // clone

function connect(o, callback) {
    if (typeof o === 'function') {
        callback = o
    } else {
        userOptions(o)
    }

    callback = (typeof callback === 'function') ? callback : function() {}

    device = new hid.HID(findWheel())

    device.read(function(err, data) {
        if (err) {
            if (options.debug) {
                console.log('connect -> Error reading from device.', err)
            }
            callback(err)
        }

        forceOff()

        if (data.length === 11) {
            // wheel is already in high precision mode

            if (options.debug) {
                console.log('connect -> wheel already in high precision mode')
            }

            listen(true, callback)
        } else {
            // wheel is not in high precision mode

            if (options.debug) {
                console.log('connect -> initing')
            }

            // G27 Racing Wheel init from https://www.lfs.net/forum/post/1587144#post1587144
            device.write([0xf8, 0x0a, 0x00, 0x00, 0x00, 0x00, 0x00])
            device.write([0xf8, 0x09, 0x04, 0x01, 0x00, 0x00, 0x00])

            // wait for wheel to finish calibrating
            setTimeout(function() {
                listen(false, callback)
            }, 7500)
        }
    })

    forceConstant(1) // move wheel to generate a read event
} // connect

function disconnect() {
    device.close()
} // disconnect

function findWheel() {
    var devices = hid.devices()
    var devicePath = ''

    for (var i in devices) {
        if (devices[i].product === 'G27 Racing Wheel') {
            devicePath = devices[i].path
            break
        }
    }

    if (devicePath === '') {
        if (options.debug) {
            console.log('findWheel -> Oops, could not find G27 Racing Wheel. Is is plugged in?')
        }
    } else if (options.debug) {
        console.log('findWheel -> Found G27 Racing Wheel at ' + devicePath)
    }

    return devicePath
} // findWheel

function on(str, func) {
    return eventEmitter.on(str, func)
} // on

function once(str, func) {
    return eventEmitter.once(str, func)
} // once

function reduceNumberTo(num, to) {
    // reduce 'num' by 128, 64, 32, etc... without going lower than 'to'

    to = to * 2

    var y = 128

    while (y > 1) {
        if (num < to) {
            break
        }

        if (num - y >= 0) {
            num = num - y
        }

        y = y / 2
    }

    return num
} // reduceNumberTo

function relay(data) {
    if (Array.isArray(data)) {
        device.write(data)
    }
} // relay

function round(num, exp) {
    if (typeof exp === 'undefined' || +exp === 0) {
        return Math.round(num)
    }

    num = +num
    exp = +exp

    if (isNaN(num) || !(typeof exp === 'number' && exp % 1 === 0)) {
        return NaN
    }

    // Shift
    num = num.toString().split('e')
    num = Math.round(+(num[0] + 'e' + (num[1] ? (+num[1] + exp) : exp)))

    // Shift back
    num = num.toString().split('e')
    return +(num[0] + 'e' + (num[1] ? (+num[1] - exp) : -exp))
} // round

function setRange() {
    if (options.range < 270) {
        options.range = 270
    }

    if (options.range > 900) {
        options.range = 900
    }

    var range1 = options.range & 0x00ff
    var range2 = (options.range & 0xff00) >> 8

    device.write([0xf8, 0x81, range1, range2, 0x00, 0x00, 0x00])
} // setRange

function userOptions(opt) {
    if (typeof opt !== 'object') return;

    for (var i in options) {
        if (opt.hasOwnProperty(i)) {
            options[i] = opt[i]
        }
    }

    if (options.debug) {
        console.log('userOptions -> ', options)
    }
} // userOptions

//----------------
// Function: LEDs
//----------------
function leds(setting) {
    /*
    Usage

        // no setting
        leds()

        // percent
        leds(1)   // all on
        leds(0.5) // half on
        leds(0)   // all off

        // string
        leds('001') // first orange only

        // array
        leds([1, 1])      // both greens on, short edition
        leds([0,0,0,1,1]) // orange and red

    */

    // no setting
    if (typeof setting === 'undefined') {
        setting = []
    }

    // percent based settings
    if (typeof setting === 'number') {
        setting = Math.round(setting * 100)

        if (setting > 84) {
            setting = '11111'
        } else if (setting > 69) {
            setting = '1111'
        } else if (setting > 39) {
            setting = '111'
        } else if (setting > 19) {
            setting = '11'
        } else if (setting > 4) {
            setting = '1'
        } else {
            setting = ''
        }
    }

    // string based settings
    if (typeof setting === 'string') {
        setting = setting.split('')
    }

    // array based settings
    if (Array.isArray(setting)) {
        if (ledPrev === setting) {
            return
        }

        var ledValues = [1, 2, 4, 8, 16]

        var ledArray = setting

        // remove any extra elements
        ledArray.splice(5, ledArray.length - 5)

        var len = ledArray.length

        setting = 0

        for (var i = 0; i < len; i++) {
            if (parseInt(ledArray[i]) === 1) {
                setting = setting + ledValues[i]
            }
        }

        /*
        Setting should be a number from 0 to 31

            From outside in, mirrored on each side.

            0 = No LEDs
            1 = Green One
            2 = Green Two
            4 = Orange One
            8 = Orange Two
            16 = Red

            31 = All LEDs

        */

        try {
            device.write([0xf8, 0x12, setting, 0x00, 0x00, 0x00, 0x01])

            // update global variable for next time
            ledPrev = setting
        } catch(err) {
            // do nothing
        }
    }
} // leds

//--------------------
// Functions: Shifter
//--------------------
function shifterBlackButtons(data, memory) {
    var button = parseInt(data.toString('hex').charAt(0), 16)

    if (button - 8 >= 0) {
        // top
        button = button - 8
        memory.shifter.button_1 = 1
    } else {
        memory.shifter.button_1 = 0
    }

    if (button - 4 >= 0) {
        // right
        button = button - 4
        memory.shifter.button_2 = 1
    } else {
        memory.shifter.button_2 = 0
    }

    if (button - 2 >= 0) {
        // left
        button = button - 2
        memory.shifter.button_4 = 1
    } else {
        memory.shifter.button_4 = 0
    }

    if (button - 1 >= 0) {
        // bottom
        button = button - 1
        memory.shifter.button_3 = 1
    } else {
        memory.shifter.button_3 = 0
    }

    return memory
} // shifterBlackButtons

function shifterDpad(data, memory) {
    var button = parseInt(data.toString('hex').charAt(1), 16)

    switch (button) {
        case 8:
            // neutral
            memory.shifter.dpad = 0
            break
        case 7:
            // top left
            memory.shifter.dpad = 8
            break
        case 6:
            // left
            memory.shifter.dpad = 7
            break
        case 5:
            // bottom left
            memory.shifter.dpad = 6
            break
        case 4:
            // bottom
            memory.shifter.dpad = 5
            break
        case 3:
            // bottom right
            memory.shifter.dpad = 4
            break
        case 2:
            // right
            memory.shifter.dpad = 3
            break
        case 1:
            // top right
            memory.shifter.dpad = 2
            break
        case 0:
            // top
            memory.shifter.dpad = 1
    }

    return memory
} // shifterDpad

function shifterRedButtons(data, memory) {
    var button = data[1]

    if (button - 128 >= 0) {
        // left
        button = button - 128
        memory.shifter.button_5 = 1
    } else {
        memory.shifter.button_5 = 0
    }

    if (button - 64 >= 0) {
        // right
        button = button - 64
        memory.shifter.button_8 = 1
    } else {
        memory.shifter.button_8 = 0
    }

    if (button - 32 >= 0) {
        // middle right
        button = button - 32
        memory.shifter.button_7 = 1
    } else {
        memory.shifter.button_7 = 0
    }

    if (button - 16 >= 0) {
        // middle left
        memory.shifter.button_6 = 1
    } else {
        memory.shifter.button_6 = 0
    }

    return memory
} // shifterRedButtons

function shifterGear(data, memory) {
    var stick = data[2]
    var reverse = parseInt(data.toString('hex').charAt(21), 16) // reverse seems to be active if this field has a 1 in it

    if (reverse & 1) { // if odd number
        // reverse gear
        memory.shifter.gear = -1
        return memory
    }

    stick = reduceNumberTo(stick, 32)

    switch (stick) {
        case 0:
            // neutral
            memory.shifter.gear = 0
            break
        case 1:
            // first gear
            memory.shifter.gear = 1
            break
        case 2:
            // second gear
            memory.shifter.gear = 2
            break
        case 4:
            // third gear
            memory.shifter.gear = 3
            break
        case 8:
            // fourth gear
            memory.shifter.gear = 4
            break
        case 16:
            // fifth gear
            memory.shifter.gear = 5
            break
        case 32:
            // sixth gear
            memory.shifter.gear = 6
    }

    return memory
} // shifterGear

//-------------------
// Functions: Pedals
//-------------------
function pedalsClutch(data, memory) {
    memory.pedals.clutch = pedalToPercent(data[7])
    return memory
} // pedalsClutch

function pedalsBrake(data, memory) {
    memory.pedals.brake = pedalToPercent(data[6])
    return memory
} // pedalsBrake

function pedalsGas(data, memory) {
    memory.pedals.gas = pedalToPercent(data[5])
    return memory
} // pedalsGas

function pedalToPercent(num) {
    // invert numbers
    num = Math.abs(num - 255)

    // change to a percent like 0 for no pressure, 0.5 for half pressure, and 1 for full pressure
    num = round(num / 255, 2)

    return num
} // pedalToPercent

//------------------
// Functions: Wheel
//------------------
function wheelButtonsTop(data, memory) {
    var button = data[1]

    button = reduceNumberTo(button, 8)

    if (button - 8 >= 0) {
        button = button - 8
        memory.wheel.button_1 = 1
    } else {
        memory.wheel.button_1 = 0
    }

    if (button - 4 >= 0) {
        memory.wheel.button_4 = 1
    } else {
        memory.wheel.button_4 = 0
    }

    return memory
} // wheelButtonsTop

function wheelButtonsRight(data, memory) {
    var button = data[2]

    if (button - 128 >= 0) {
        button = button - 128
        memory.wheel.button_6 = 1
    } else {
        memory.wheel.button_6 = 0
    }

    if (button - 64 >= 0) {
        memory.wheel.button_5 = 1
    } else {
        memory.wheel.button_5 = 0
    }

    return memory
} // wheelButtonsRight

function wheelShiftPedals(data, memory) {
    var button = data[1]

    button = reduceNumberTo(button, 2)

    if (button - 2 >= 0) {
        button = button - 2
        memory.wheel.shift_left = 1
    } else {
        memory.wheel.shift_left = 0
    }

    if (button - 1 >= 0) {
        memory.wheel.shift_right = 1
    } else {
        memory.wheel.shift_right = 0
    }

    return memory
} // wheelShiftPedals

function wheelTurn(data, memory) {
    var wheelCourse = data[4] // 0-255
    var wheelFine = data[3] // 0-252

    if (wheelFine > 252) {
        wheelFine = 252
    }

    wheelCourse = wheelCourse / 255 * 99 // 99 instead of 100 so wheelCourse and wheelFine add up to 100% when they are both maxed out
    wheelFine = wheelFine / 252

    var wheel = round(wheelCourse + wheelFine, 2)

    if (wheel > 100) wheel = 100

    if (wheel < 0) wheel = 0

    memory.wheel.turn = wheel

    return memory
} // wheelTurn

//------------------
// Functions: Force
//------------------
function autoCenter() {
    /*
    Usage

        autoCenter(true)       // on
        autoCenter(false)      // off
        autoCenter([0.2, 0.5]) // on with custom effect strength and increasing turn resistance settings

    */
    var option = options.autocenter

    if (option) {
        // auto-center on
        device.write([0x14, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00])

        if (Array.isArray(option) && option.length === 2) {
            // custom auto-center

            // byte 3-4 is effect strength, 0x00 to 0x0f
            option[0] = Math.round(option[0] * 15)

            // byte 5 is the rate the effect strength rises as the wheel turns, 0x00 to 0xff
            option[1] = Math.round(option[1] * 255)

            device.write([0xfe, 0x0d, option[0], option[0], option[1], 0x00, 0x00, 0x00])
        } else {
            // use default strength profile
            device.write([0xfe, 0x0d, 0x07, 0x07, 0xff, 0x00, 0x00, 0x00])
        }
    } else {
        // auto-center off
        device.write([0xf5, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00])
    }
} // autoCenter

function forceConstant(num) {
    /*
    Usage

        forceConstant()    // no force
        forceConstant(0)   // full force left
        forceConstant(0.5) // no force
        forceConstant(1)   // full force right

    */
    if (typeof num === 'undefined') num = 0.5

    if (num === 0.5) {
        forceOff(1)
        return
    }

    num = Math.round(Math.abs(num - 1) * 255)

    device.write([0x11, 0x00, num, 0x00, 0x00, 0x00, 0x00])
} // forceConstant

function forceFriction(num) {
    /*
    Usage

        forceFriction()    // no friction
        forceFriction(0)   // no friction
        forceFriction(0.5) // half strength friction
        forceFriction(1)   // full strength friction

    */

    if (typeof num === 'undefined') num = 0

    if (num === 0) {
        forceOff(2)
        return
    }

    num = Math.round(num * 15)

    device.write([0x21, 0x02, num, 0x00, num, 0x00, 0x00])
} // forceFriction

function forceOff(slot) {
    /*
    Usage

        forceOff()  // turn off effects in all slots
        forceOff(1) // turn off effect in slot 1
        forceOff(2) // turn off effect in slot 2
        forceOff(3) // turn off effect in slot 3
        forceOff(4) // turn off effect in slot 4

    Great info at http://wiibrew.org/wiki/Logitech_USB_steering_wheel, especially about writing to more than one effect slot.

    */
    if (typeof slot === 'undefined') {
        slot = 0xf3
    } else {
        slot = parseInt('0x' + slot + '0')
    }

    // turn off effects (except for auto-center)
    device.write([slot, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00])
} // forceOff

//------------------
// Function: Listen
//------------------
function listen(ready, callback) {
    if (!ready) {
        device.close()
        device = new hid.HID(findWheel())
    }

    setRange()
    autoCenter()

    device.on("data", function(data) {
        //----------
        // Data Map
        //----------
        /*
        Hex based string position...

            Zero
                Shifter - Black Buttons
                    1 = Bottom
                    2 = Left
                    4 = Right
                    8 = Top

            One
                Shifter - Dpad
                    0 = Top
                    1 = Top Right
                    2 = Right
                    3 = Bottom Right
                    4 = Bottom
                    5 = Bottom Left
                    6 = Left
                    7 = Top Left
                    8 = Dpad in Neutral Position

            Two
                Shifter - Red Buttons
                    1 = Middle Left
                    2 = Middle Right
                    4 = Right
                    8 = Left

        Interger based array position...

            Zero
                Shifter - Dpad
                    0 = Top
                    1 = Top Right
                    2 = Right
                    3 = Bottom Right
                    4 = Bottom
                    5 = Bottom Left
                    6 = Left
                    7 = Top Left
                    8 = Dpad in Neutral Position

                Shifter - Black Buttons
                     16 = Bottom
                     32 = Left
                     64 = Right
                    128 = Top

            One
                Wheel - Shifter Pedals
                    1 = Right Shifter
                    2 = Left Shifter

                Wheel - Red Buttons
                    4 = Top Right
                    8 = Top Left

                Shifter - Red Buttons
                     16 = Middle Left
                     32 = Middle Right
                     64 = Right
                    128 = Left

            Two
                Shifter - Gear Selector
                     0 = Neutral
                     1 = 1st Gear
                     2 = 2nd Gear
                     4 = 3rd Gear
                     8 = 4th Gear
                    16 = 5th Gear
                    32 = 6th Gear

                    See array ten for reverse.

                Wheel - Red Buttons
                     64 = Middle Right
                    128 = Bottom Right

            Three
                Wheel - Red Buttons
                    1 = Middle Left
                    2 = Bottom Left

                    Not sure how to split these values since they get mixed in with wheel turn data.

                Wheel - Wheel Turn
                    0-252

                    0 is far left
                    252 is far right

            Four
                Wheel - Wheel Turn
                    0-255

                    0 is far left
                    255 is far right

            Five
                Pedals - Gas
                    0-255

                    0 is full gas
                    255 is no pressure

            Six
                Pedals - Brake
                    0-255

                    0 is full brake
                    255 is no pressure

            Seven
                Pedals - Clutch
                    0-255

                    0 is full clutch
                    255 is no pressure

            Eight
                Shifter - Gear Selector
                    ~60 to ~190

                    X coordinates.
                    ~60 is far left.
                    ~190 is far right.

                    Can probably go from 0 to 255 if not physically restricted by gear channels.

            Nine
                Shifter - Gear Selector
                    0 to ~215

                    Y coordinates.
                    0 is the lever pulled down into 4th gear.
                    ~215 is the lever pushed forward into 3rd gear.

                    Can probably go to 255 if not physically restricted gear channels.

            Ten
                Shifter - Gear Selector
                    24 or 28 = Shifter not pushed down
                    88 or 92 = Shifter pushed down (most likely in preparation to shift into reverse soon)
                    89 or 93 = Shifter in Reverse

        */

        // reset memory
        var memory = clone(memoryPrev)
        var memoryCache = clone(memoryPrev)

        var dataDiffPositions = []

        // find out if anything has changed since the last event
        var dataLength = data.length
        for (var i = 0; i < dataLength; i++) {
            if (data[i] !== dataPrev[i]) {
                dataDiffPositions.push(i)
            }
        }

        if (dataDiffPositions.length === 0) {
            return
        }

        for (var i in dataDiffPositions) {
            switch (dataDiffPositions[i]) {
                case 0:
                    memory = shifterBlackButtons(data, memory)
                    memory = shifterDpad(data, memory)
                case 1:
                    memory = shifterRedButtons(data, memory)
                    memory = wheelShiftPedals(data, memory)
                    memory = wheelButtonsTop(data, memory)
                    break
                case 2:
                    memory = shifterGear(data, memory)
                    memory = wheelButtonsRight(data, memory)
                    break
                case 3:
                case 4:
                    memory = wheelTurn(data, memory)
                    break
                case 5:
                    memory = pedalsGas(data, memory)
                    break
                case 6:
                    memory = pedalsBrake(data, memory)
                    break
                case 7:
                    memory = pedalsClutch(data, memory)
                    break
                case 10:
                    memory = shifterGear(data, memory) // for reverse
            }
        }

        //-------------------------
        // Figure out what changed
        //-------------------------
        var memoryDiff = {}
        var count = 0

        for (var o in memoryCache) {
            for (var y in memory[o]) {
                if (memory[o][y] != memoryCache[o][y]) {
                    if (!memoryDiff.hasOwnProperty(o)) {
                        memoryDiff[o] = {}
                    }
                    eventEmitter.emit(o + '-' + y, memory[o][y]) // for example, wheel-button_1
                    memoryDiff[o][y] = memory[o][y]
                    count = count + 1
                }
            }
        }

        if (count > 0) {
            if (options.debug) {
                console.log(memoryDiff)
            }

            // emit changes only
            eventEmitter.emit('changes', memoryDiff)
        }

        // emit everything in all event
        eventEmitter.emit('all', memory)

        // set global variables for next event
        memoryPrev = memory
        dataPrev = data
    })
    device.on("error", function(err) {
        if (options.debug) {
            console.log('device error -> ', JSON.stringify(err), err)
        }
    })

    leds(0)

    if (options.debug) {
        console.log('listen -> listening')
    }

    callback(null)
} // listen

//---------
// Exports
//---------
module.exports.connect = connect
module.exports.disconnect = disconnect

// events
module.exports.emitter = eventEmitter
module.exports.on = on
module.exports.once = once

// leds
module.exports.leds = leds

// force
module.exports.forceConstant = forceConstant
module.exports.forceFriction = forceFriction
module.exports.forceOff = forceOff

// advanced
module.exports.relay = relay
