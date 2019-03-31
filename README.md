# React Animation Orchestrator

#### A react-based library for managing complex animations

![react-fancy-multi-select](https://user-images.githubusercontent.com/46129036/55287638-5235ff80-53b4-11e9-8a78-09523622aadf.gif)

---

`state = (oldState, action) => newState`

but

`animation = (time) => frame`

---

React Animation Orchestrator is a library that solves the problem of discrepancy between the fact that state changes are nearly instantaneous but animations, by definition, take time to complete.

It provides *higher order components* to manage multiple, complex animations in an app that contains a lot of state changes that affect its animations,oftentimes even while other animations are running

Based on the timeline feature of the incredible [GSAP](https://greensock.com/gsap) animation library it offers:

* Different modes of resolving conflicting animations (queueing or fast-forwarding animations)
* Support for Static/Dynamic Animations
* Triggering animations from a state change or from user-initiated events (mouse click, scroll etc)
* Taking care of annoying edge cases, like how components shouldn't be removed from the DOM until they've performed their requested animations.

See a live demo [here!](https://codesandbox.io/s/github/ekolabs/react-fancy-multi-select)

---

## Overview

React Animation Orchestrator is used in two major steps: Defining animations and Describing scenarios that decide when to run these animations.

1. First, a user [decorates](#attachAnimation) a React component to become an `AnimatedComponent`. An `AnimatedComponent` can use its `registerAnimation` function to register animation specific to the component domain, to be later used within a scenario.

2. An `AnimatedComponent` is configured with a set of [Scenarios](#ScenarioConfiguration) with the [`attachAnimation`](#attachAnimation) function, to act as a *"controller"* of sorts to its domain-specific animations. Once the props of an `AnimatedComponent` change, all [triggers](#TriggerConfiguration) in all of its scenarios are evaluated. If one of the triggers is evaluated to be triggered, the animations associated with the scenario the trigger belongs to are added to a timeline.

Woah that was a mouthful - in practice this should be much clearer:

## Usage example

```javascript
npm install @ekolabs/react-animation-orchestrator
```

Defining and registering animation for a component:

```js
import React from "react";
import { TimelineMax } from 'gsap';
import { attachAnimation } from "@ekolabs/react-animation-orchestrator";

// an example of an animation generator function
const lookAtMeAnimation = (ref, options) => {
    let tl = new TimelineMax();
    let myEl = ref.current;

    tl.to(myEl, 0.5, {
            scale: 1.5,
            rotating: '45deg',
            transformOrigin: 'center',
            opacity: 0.7
        })
        .to(myEl, 0.2, {
            scale: 1,
            rotating: '0deg',
            transformOrigin: 'center',
            opacity: 1
        });

    return tl;
};

class FancyComponent extends React.Component {
    constructor(props){
        super(props);
        this.ref = React.createRef();
        this.props.registerAnimation('lookAtMe', lookAtMeAnimation, this.ref);
    }

    render(){
        return (
            <div ref={this.ref}>Attention-grabbing element</div>
        )
    }
}

export default attachAnimation(FancyComponent);
```

Configuring scenarios to trigger animations

```js
import React from "react";
import { attachAnimation } from "@ekolabs/react-animation-orchestrator";
import FancyComponent from "./FancyComponent";

class PageComponent extends React.Component {
  
    render(){
        return (
            <div>
                <FancyComponent/>
                <AnotherComponent />
                <MoreComponents />
            </div>
        )
    }
}

export default attachAnimation(PageComponent, [
    // when the grabAttention prop changes from false to true,
    // we want to queue the lookAtMe animation
    {
        id: 'someChange',
        trigger: {
             select: props => props.grabAttention,
             value: false,
             nextValue: true
        },
        animations: 'lookAtMe'
    }
]);

```

## API

<a name="registerAnimation"></a>

**registerAnimation(animationId, animationGeneratorFunction, elementReference)**

Registers a new animation for an AnimatedComponent. This method is a available in the props of an attached component.

| Parameter| Type | Value           |
| ------------- |----- |--------|
| animationId | string | A unique id for this animation
| animationGeneratorFunction| [AnimationGenrator](#AnimationGenerator) | The animation generator function for this reference
| elementReference | [React ref](https://reactjs.org/docs/refs-and-the-dom.html#creating-refs) | A React reference for the DOM object being animated

```js
// example
class FancyComponent extends React.Component {
    constructor(props){
        super(props);
        this.ref = React.createRef();
        this.props.registerAnimation('lookAtMe', lookAtMeAnimation, this.ref);
    }

    render(){
        return (
            <div ref={this.ref}>Attention-grabbing element</div>
        )
    }
}
```

<a name="attachAnimation"></a>

**attachAnimation(WrappedComponent, scenariosConfig)**

Creates a higher-order component `AnimatedComponent` based on the supplied component, along with its scenario configurations.

| Parameter| Type | Value           |
| ------------- |----- |--------|
WrappedComponent | React.Component | A react component class (not an instance) |
| scenariosConfig| [Scenario Configuration](#ScenarioConfiguration) | An array of scenario configurations to be managed by this component (optional)|

**addAnimation(animations, timelineOrTimelineId, options)**

Manually add animations to a timeline

| Parameter| Type | Value           |
| ------------- |----- |--------|
animations | An array of [AnimationConfiguration](#AnimationConfiguration) | The animations to run
| timelineOrTimelineId | A timeline id or a timeline instance | The timeline to add the animations to. If a timeline with such id does not exist, a new timeline will be created.
options | object | The options will be passed as the second parameter of the [animation generator function](#AnimationGenerator).

**triggerScenario(scenarioId)**

Manually triggers the scenario's animations

| Parameter| Type | Value           |
| ------------- |----- |--------|
scenarioId | string | The id of the scenario to trigger.

**setGlobalOptions(options)**

Sets global options for React Animation Orchestrator.
Options are:

```js
// example
{
    onScenarioTriggered: (matchedScenario) => {},
    onScenarioStart: (refs, scenarioConfig, triggerConfig) => {},
    onScenarioComplete: (refs, scenarioConfig, triggerConfig) => {}
}

```

## Configuration

### <a name="ScenarioConfiguration"></a> Scenario

A scenario describes a set of animations to be added to a timeline once a certain [trigger](#TriggerConfiguration) has been met.

| Property| Type | Value |
| --- | --- | --- |  
| id | string | The scenario ID |
| trigger| [TriggerConfiguration](#TriggerConfiguration) \| array of TriggerConfiguration   | Triggers associated with this scenario.
| timeline | string  | The id of the animation where the animations will be inserted to. If not specified the default master timeline is used.
| animations | [AnimationConfiguration](#AnimationConfiguration) | Describes which animations will be added once a trigger is met
| interrupt | boolean | If true, all other animations currently present in the timeline will complete immediately before adding this scenario's animations.

### <a name="TriggerConfiguration"></a> Trigger Configuration

A trigger describes a certain change in props that if evaluated to be true will ultimately result in addition of animations to a timeline

Can either be an object or a function

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
}
```

Trigger function Parameters:

| Property| Type | Value |
| --- | --- | --- |  
| triggerComponent | React.Component instance | The instance of the attached component.
| prevProps| object  | The props before the change.
| nextProps | object  | The props after the change.

### <a name="AnimationConfiguration"></a> Animation

An animation is a configuration which is ultimately resolved into a GSAP sub-timeline using an Animation Generator function, and then added to a Animation Orchestrator timeline.

Can either be a string, an object, a function or an array containing these types for multiple animations.

***As a string***

```'fadeIn'```

***As an Object***

```js
// example
{
 animation: 'fadeIn',
 position: 'withPrev',
 immediate: false,
 onComplete: ()=>{ console.log()}
}

```

| Property| Type | Value |
| --- | --- | --- |  
| animation | string | The animation ID. |
| timeline | string  | The timeline id to insert the animation into. If not specified the default master timeline is used.
| position | string \| number \| 'withPrev' | Where in the timeline to place the animation. Maps to GSAP position paramater, See [documentation](https://greensock.com/docs/TimelineMax/add). Also accepts a special `withPrev` value that places this animation at the start time of the previous animation in the timeline.
| immediate | boolean | If true, animation will complete instantly (duration ~0).
onStart | function | A callback that will fire when the animation starts. See [callback function signature](#AnimationCallback).
onComplete| function | A callback that will fire when the animation ends. See [callback function signature](#AnimationCallback).
animationOptions | object | This object will be passed to the animation generator as a second parameter. Useful for passing data to dynamic animations.

***As a function***

The animation configuration function will be evaluated when a trigger condition is met. This is useful for dynamic animations.
Must return an object or a string (as described above)

```js
// example
animatedComponentInstance => {
    animation: 'fadeIn',
    position: '+=2',
    animationsOptions: {
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

### <a name="AnimationCallback"></a> Animation Callback Function

The function that gets executed once when `onStart` or `onComplete` is defined for an animation.

| Property| Type | Value |
| --- | --- | --- |  
| refs.animatedComponent | AnimatedComponent | A reference to the component being animated
| refs.triggerComponent | AnimatedComponent | A reference to the component that triggered the scenario (will be `null` if animation was triggered manually via `addAnimation`)
| refs.tween | Tween | A reference to GSAP tween object

```js
// example
(refs) => {}
```

### <a name="AnimationGenerator"></a> Animation Generator Function

A function that generates a sub-timeline that describes the animation.
Returns a [GSAP timeline](https://greensock.com/docs/TimelineMax).

| Property| Type | Value |
| --- | --- | --- |  
| ref | [React ref](https://reactjs.org/docs/refs-and-the-dom.html#creating-refs) | The element reference passed in [`registerAnimation`](#registerAnimation) |
| options | object  | The value of animationOptions as configured in an [AnimationConfiguration](#AnimationConfiguration) (optional)

```js
// example
(ref, options) => {
    let tl = new TimelineMax();
    let myEl = ref.current;

    tl.to(myEl, 0.5, {
            scale: 1.5,
            rotating: '45deg',
            transformOrigin: 'center',
            opacity: 0.7
        });

    return tl;
};

```

## Contributing

When contributing to this repository, please first discuss the change you wish to make via issue, email, or any other method before submitting a PR.

## Authors

* **Opher Vishnia** - [Opherv](https://github.com/Opherv)

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details
