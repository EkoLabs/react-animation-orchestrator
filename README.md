# React Animation Orchestrator

#### A react-based library for managing complex animations

`state = (oldState, action) => newState`

but

`animation = (time) => frame` 

React Animation Orchestrator is a library that solves the problem of discrepancy between the fact that state changes are nearly instantaneous but animations, by definition, take time to complete.
    
 It provides *higher order components* to manage multiple, complex animations in an app that contains a lot of state changes that affect its animations, oftentimes even while other animations are running
 
 Based on the timeline feature of the incredible [GSAP](https://greensock.com/gsap) animation library it offers:
    

 * multiple
 * Static/Dynamic Animations
 
 See a live demo [live!]()

React Animation Orchestrator can ensures that animations will run sequentially. It also takes care of many annoying edge cases:
 
 * components shouldn't be removed from the DOM until they've performed their required animations.

## Usage example

```javascript
npm install @ekolabs/react-animation-orchestrator
```



## Overview

React Animation Orchestrator has to major parts: Defining animations and Describing scenarios of when to run these animations.

First, a user <a href="#attachAnimation">decorates</a> a component to become an `AnimatedComponent`. An AnimatedComponent can use its `registerAnimation` function to register animation specific to the component domain, to be later used within a scenario.

An `AnimatedComponent` can also be configured with a set of <a href="#ScenarioConfiguration">Scenarios</a> with the <a href="#attachAnimation">`attachAnimation`</a> function, to act as a *"controller"* of sorts to its domain-specific animations. Once the props of an AnimatedComponent change, all <a href="#TriggerConfiguration">triggers</a> in all of its scenarios are evaluated. If one of the triggers is evaluated to be triggered, the configured animation associated with the scenario the trigger belongs to are added to a timeline.
  

## API

<a id="attachAnimation" >

**attachAnimation(WrappedComponent, [scenariosConfig])**

| Parameter| Type | Value           |
| ------------- |----- |--------| 
WrappedComponent | React.Component | A react component class (not an instance) |
| scenariosConfig| <a href="ScenarioConfiguration">Scenario Configuration</a> | An array of scenario configurations to be managed by this component (optional)|

**addAnimation**

**triggerScenario**

**setGlobalOptions**


##Configuration

###<span id="ScenarioConfiguration">Scenario
A scenario describes a set of animations to be added to a timeline once a certain <a href="#TriggerConfiguration">trigger</a> has been met.

| Property| Type | Value |
| --- | --- | --- |  
| id | string | The scenario ID |
| trigger| <a href="#TriggerConfiguration">TriggerConfiguration</a> / array of TriggerConfiguration   | Triggers associated with this scenario 
| timeline | string  | The id of the animation where the animations will be inserted to. If not specified the default master timeline is used.
| animations | <a href="#AnimationConfiguration">AnimationConfiguration</a> | Describes which animations will be added once a trigger is met
| interrupt | boolean | if true, all other animations currently present the timeline will complete immediately before adding this scenario's animations 


###<span id="TriggerConfiguration">Trigger Configuration

A trigger describes a certain change in props that if evaluated to be true will ultimately result in addition of animations to a timeline

Can be either an object or a function

***As an object***

When testing the trigger, the `select` function will be executed with the props as its parameter once on the previous props and once on the next (changed) props. If the result of the previous props selection is equal to `value` and the next props selection is equal to `nextValue` the trigger is considered, well, triggered.

```js
{
    // example
    {
        select: props => props.varToCheck,
        value: 'oldValue',
        nextValue: 'newValue'
    }
}

```

***As a function***

This allows more custom logic of props comparison to determine how to evaluate the trigger.

```js
    // example
    (triggerComponent, prevProps, nextProps) => {   
                nextProps.VarToCheck === prevProps.varToCheck + 1;                
            },
```

Trigger function Parameters:

| Property| Type | Value 
| --- | --- | --- |  
| triggerComponent | React.Component instance | The instance of the attached component
| prevProps| object  | The props before the change 
| nextProps | object  | The props after the change

 


###<span id="AnimationConfiguration">Animation</span>

An animation is a configuration which is ultimately resolved into a GSAP sub-timeline using an Animation Generator function, and then added to a Animation Orchestrator timeline 
 
Can be either a string, an object, a function or an array containing these types for multiple animations.

***As a string***

```'fadeIn```

***As an Object***
```js
{
 animation: 'fadeIn',
 position: 'withPrev',
 immediate: false,
 onComplete: ()=>{}
}

```

Possible properties are:

| Property| Type | Value |
| --- | --- | --- |  
| Animation | string | The animation ID |
| timeline | string  | The id of timeline to insert the animation. If not specified the default master timeline is used.
| position | string / number / 'withPrev' | Where in the timeline to place the animation. Maps to GSAP position paramater, See [documentation](https://greensock.com/docs/TimelineMax/add). Also accepts a special `withPrev` value that places this animation at the start time of the previous animation in the timeline.
| immediate | boolean | if true, animation will completely instantly (duration ~0)
onStart | function | A callback that will fire when the animation starts. See callback function signature
onComplete| function | A callback that will fire when the animation ends. See callback function signature 
animationOptions | object | This object will be passed to the animation generator as a second parameter. Useful for passing data to dynamic animations.

***As a function***

The animation configuration function will be evaluated when a trigger condition is met. This is useful for dynamic animations.
Must return an object or a string (as described above)

```js 
    animatedComponentInstance => {
                     animation: 'fadeIn',
                     position: '+=2',
                     animationsOptions" {
                        myVar: 12
                     }
                 }

```

***As an array of animations***

```['fadeIn', 'expand']```


Usage:
```js
import { attachAnimation } from "@ekolabs/react-animation-orchestrator";

attachAnimation(WrappedComponent, [
    {
        id: 'myAnimation1'
        trigger: ...,
        animations: ...
    },
    {
        id: 'myAnimation2',
        trigger: ...,
        animations: ...
    },
    ...
    ])
```


## Contributing

## Authors

* **Opher Vishnia** - [Opherv](https://github.com/Opherv)


## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details

