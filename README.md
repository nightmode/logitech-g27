# Logitech G27 Racing Wheel for Node.js

Bring your Logitech G27 Racing Wheel into the wonderful world of Node and...

* set wheel auto-centering and range.
* subscribe to wheel, shifter, and pedal events.
* activate simple force feedback effects.
* play with shift indicator LEDs.

## Install

```
npm install logitech-g27
```

## Example

Let's have some fun and make our LEDs light up when we press the gas pedal.

```js
var g = require('logitech-g27')

g.connect(function(err) {
    g.on('pedals-gas', function(val) {
        g.leds(val)
    })
})
```

Neat ya!

## API

* [connect](#connect)
  * [options](#options)
* [disconnect](#disconnect)
* [events](#events)
  * [event map](#event-map)
  * [on](#on)
  * [once](#once)
* [force](#forceConstant)
  * [forceConstant](#forceConstant)
  * [forceFriction](#forceFriction)
  * [forceOff](#forceOff)
* [leds](#leds)
* [special](#special)
  * [emitter](#emitter)
  * [relay](#relay)

### connect

`connect(callback)` or `connect(options, callback)`

Connect to the wheel and receive a callback once it is ready.

```js
g.connect(function(err) {
    console.log('Ready')
})
```

Connect with `options`.

```js
var options = {
    autocenter: false,
    range: 270
}

g.connect(options, function(err) {
    console.log('Ready')
})
```

### options

The following options can be set when using `connect(options, callback)`.

|Option|Default|Type|Examples|
|:-|:-|:-|:-|
|autocenter|true|boolean or array|true, false, [0.3, 0.7]|
|debug|false|boolean|true, false|
|range|900|number|270, 900|

`autocenter` can be fine tuned if you provide a two element array. The first value (0 - 1) controls the general strength of the auto-centering. The second value (0 - 1) controls how quickly that strength ramps up as you turn the wheel more.

`debug` enables a lot of console logging. 

`range` is a number from 270 to 900. Range sets the degrees of turn it takes before the wheel reports a maximum value for that direction. For example, if the range is 270, it won't take much turning before you receive a min or max return value. Even if you can physically turn the wheel more in the same direction, the return value will be the same.

### disconnect

`disconnect()`

Disconnect to allow other software to use wheel or in preparation to connect again.

### events

Events can be subscribed to using `on` and `once`.

For example, if you wanted to listen for wheel turns and gear changes you could write:

```js
g.on('wheel-turn', function(val) {
    console.log('Wheel turned to ' + val)
}).on('shifter-gear', function(val) {
    console.log('Shifted into ' + val)
})
```

Let's go over each event in detail.

**Wheel Events**

|Event|Returns|Values|Notes|
|:-|:-|:-|:-|
|`wheel-turn`|number|0 - 100|0 is full right<br>50 is centered<br>100 is full left|
|`wheel-shift_left`|binary|0, 1||
|`wheel-shift_right`|binary|0, 1||
|`wheel-button_1`|binary|0, 1||
|`wheel-button_4`|binary|0, 1||
|`wheel-button_5`|binary|0, 1||
|`wheel-button_6`|binary|0, 1||

Wondering where `wheel-button_2` and `wheel-button_3` are? Their data is mixed in with wheel turn information and lost in the USB streams of time. I suspect it might be possible to read their events at a bit level. Not sure how or if that is even possible so bright ideas are welcome. ^_^

**Shifter Events**

|Event|Returns|Values|Notes|
|:-|:-|:-|:-|
|`shifter-button_1`|binary|0, 1||
|`shifter-button_2`|binary|0, 1||
|`shifter-button_3`|binary|0, 1||
|`shifter-button_4`|binary|0, 1||
|`shifter-dpad`|number|0 - 8|0 = neutral<br>1 = north<br>2 = northeast<br>3 = east<br>4 = southeast<br>5 = south<br>6 = southwest<br>7 = west<br>8 = northwest
|`shifter-button_5`|binary|0, 1||
|`shifter-button_6`|binary|0, 1||
|`shifter-button_7`|binary|0, 1||
|`shifter-button_8`|binary|0, 1||
|`shifter-gear`|number|0 - 6, -1|0 = neutral<br>1-6 = gears<br>-1 = reverse|

**Pedal Events**

|Event|Returns|Values|Notes|
|:-|:-|:-|:-|
|`pedal-gas`|number|0 - 100|0 is no pressure and 100 is full.|
|`pedal-brake`|number|0 - 100|0 is no pressure and 100 is full.|
|`pedal-clutch`|number|0 - 100|0 is no pressure and 100 is full.|

Not enough events for you? Try subscribing to the pseudosecret `changes` or `all` events and see what happens. ^_^

### event map

[![Event Map](https://raw.github.com/ForestMist/logitech-g27/master/images/event-map.jpg)](https://raw.github.com/ForestMist/logitech-g27/master/images/event-map.jpg)

### on

`on(event, callback)`

Can be setup before or after `connect(callback)`.

```js
g.on('wheel-button_4', function(val) {
    if (val) {
        console.log('I really love it when you press my buttons.')
    }
})
```


### once

`once(event, callback)`

Can be setup before or after `connect(callback)`.

```js
g.once('pedals-gas', function(val) {
	// the following will only happen one time
    console.log('Powered by dead dinosaur juice; your engine roars to life!')
})
```

### forceConstant

`forceConstant(num)` where num is 0 - 1 to indicate both direction and strength.

```js
forceConstant()    // no force
forceConstant(0)   // full left
forceConstant(0.5) // no force
forceConstant(1)   // full right
```

### forceFriction

`forceFriction(num)` where num is 0 - 1 to indicate effect strength.

```js
forceFriction()    // no friction
forceFriction(0)   // no friction
forceFriction(0.5) // half strength
forceFriction(1)   // full strength
```

### forceOff

`forceOff()`

Turn off all force effects except for auto-centering.


### leds

`leds()` or `leds(num)` or `leds(string)` or `leds(array)`

The shift indicator LEDs can interfaced with in a variety of ways.

`led()` is the easiest way to turn off all LEDs.

`led(num)` where num is between 0 - 1 to indicate a percent.

```js
g.led(0.45) // the least accurate way to control LEDs since an arbitrary scale will be used for conversion
```

`led(string)` where string is zero to five characters of zeroes or ones.

```js
g.leds('')      // all off
g.leds('1')     // green
g.leds('111')   // green, green, orange
g.leds('00001') // red only
```

`led(array)` where array is zero to five elements of zeroes or ones.

```js
g.leds([])          // all off
g.leds([1])         // green
g.leds([1,1,1])     // green, green, orange
g.leds([0,0,0,0,1]) // red only
```

### special

If your handle is Zero Cool, Acid Burn or Lord Nikon, you'll probably like `emitter` and `relay`.

### emitter

`emitter.` + [nodejs.org/api/events.html](https://nodejs.org/api/events.html)

Exposes the EventEmitter that this library uses behind the scenes.

```js
g.emitter.removeAllListeners('shifter-gear')
```

### relay

`relay(data)`

Relay low level commands directly to the hardware.

```js
// turn on all LEDs
g.relay([0xf8, 0x12, 0x1f, 0x00, 0x00, 0x00, 0x01])
```

## License

MIT © [Daniel Gagan](https://forestmist.org)
