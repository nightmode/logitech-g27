'use strict'

//----------
// Data Map
//----------
/*
Details on each item of the read buffer provided by node-hid for the Logitech G27.

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
            0000 0001 = Middle Left
            0000 0010 = Bottom Left

        Wheel - Wheel Turn (fine movement)
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
        Shifter
            X Coordinates (not used)

    Nine
        Shifter
            Y Coordinates (not used)

    Ten
        Shifter - Gear Selector
            0000 0001 = Reverse Gear

        Shifter
            Contains data on whether or not the gear selector is pressed down into the unit.
            If pressed down, the user is probably preparing to go into reverse. (not used)
*/

//-----------
// Functions
//-----------
function dataMap(dataDiffPositions, data, memory) {
    /*
    Figure out what has changed since the last event and call relevent functions to translate those changes to a memory object.
    @param   {Object}  dataDiffPositions  An array.
    @param   {Buffer}  data               Buffer data from a node-hid event.
    @param   {Object}  memory             Memory object to modify.
    @return  {Object}  memory             Modified memory object.
    */
    for (var i in dataDiffPositions) {
        switch (dataDiffPositions[i]) {
            case 0:
                memory = shifterBlackButtons(data, memory)
                memory = shifterDpad(data, memory)
                break
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
                memory = wheelButtonsLeft(data, memory)
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

    return memory
} // dataMap

function reduceNumberFromTo(num, to) {
    /*
    Reduce a number by 128, 64, 32, etc... without going lower than a second number.
    @param   {Number}  num
    @param   {Number}  to
    @return  {Number}
    */
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
} // reduceNumberFromTo

function round(num, exp) {
    /*
    Round a number to a certain amount of places.
    @param   {Number}  num  Number like 1.567.
    @param   {Number}  exp  Number of places to round to.
    @return  {Number}
    */
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

//------------------
// Functions: Wheel
//------------------
function wheelButtonsLeft(data, memory) {
    var d = data[3]

    memory.wheel.button_2 = d & 1
    memory.wheel.button_3 = (d & 2) ? 1 : 0

    return memory
} // wheelButtonsRight

function wheelButtonsRight(data, memory) {
    var d = data[2]

    memory.wheel.button_6 = (d & 128) ? 1 : 0
    memory.wheel.button_5 = (d & 64) ? 1 : 0

    return memory
} // wheelButtonsRight

function wheelButtonsTop(data, memory) {
    var d = data[1]

    memory.wheel.button_1 = (d & 8) ? 1 : 0
    memory.wheel.button_4 = (d & 4) ? 1 : 0

    return memory
} // wheelButtonsTop

function wheelShiftPedals(data, memory) {
    var d = data[1]

    memory.wheel.shift_right = d & 1
    memory.wheel.shift_left = (d & 2) ? 1 : 0

    return memory
} // wheelShiftPedals

function wheelTurn(data, memory) {
    var wheelCourse = data[4] // 0-255
    var wheelFine = data[3] // 0-252

    if (wheelFine & 1) {
        wheelFine -= 1
    }

    if (wheelFine & 2) {
        wheelFine -= 2
    }

    wheelCourse = wheelCourse / 255 * 99 // 99 instead of 100 so wheelCourse and wheelFine add up to 100% when they are both maxed out
    wheelFine = wheelFine / 252

    var wheel = round(wheelCourse + wheelFine, 2)

    if (wheel > 100) wheel = 100

    if (wheel < 0) wheel = 0

    memory.wheel.turn = wheel

    return memory
} // wheelTurn

//-------------------
// Functions: Pedals
//-------------------
function pedalsBrake(data, memory) {
    memory.pedals.brake = pedalToPercent(data[6])
    return memory
} // pedalsBrake

function pedalsClutch(data, memory) {
    memory.pedals.clutch = pedalToPercent(data[7])
    return memory
} // pedalsClutch

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

//--------------------
// Functions: Shifter
//--------------------
function shifterBlackButtons(data, memory) {
    var d = data[0]

    memory.shifter.button_1 = (d & 128) ? 1 : 0
    memory.shifter.button_2 = (d & 64) ? 1 : 0
    memory.shifter.button_3 = (d & 16) ? 1 : 0
    memory.shifter.button_4 = (d & 32) ? 1 : 0

    return memory
} // shifterBlackButtons

function shifterDpad(data, memory) {
    var dpad = reduceNumberFromTo(data[0], 8)

    switch (dpad) {
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

function shifterGear(data, memory) {
    var reverse = data[10]

    if (reverse & 1) {
        memory.shifter.gear = -1
        return memory
    }

    var stick = data[2]
    stick = reduceNumberFromTo(stick, 32)

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

function shifterRedButtons(data, memory) {
    var d = data[1]

    memory.shifter.button_5 = (d & 128) ? 1 : 0
    memory.shifter.button_8 = (d & 64) ? 1 : 0
    memory.shifter.button_7 = (d & 32) ? 1 : 0
    memory.shifter.button_6 = (d & 16) ? 1 : 0

    return memory
} // shifterRedButtons

//---------
// Exports
//---------
module.exports = dataMap