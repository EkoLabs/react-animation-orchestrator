import React from 'react';
import { TimelineMax } from 'gsap';

let globalOptions = {};

// map between timeline id and timeline instance. create default timeline 'master'
const timelines = {
    master: new TimelineMax({
        autoRemoveChildren: true
    })
};

// maps between mounted components and their instances. used for debugging
const components = {};
const scenarios = {};

let scenarioIdCounter = 0;
let componentIdCounter = 0;
let animationIdCounter = 0;

function attachAnimation(WrappedComponent, scenariosConfig = []){

    scenariosConfig.forEach(scenarioConfig => {
        // add ids to scenario configs with no id specified
        if ('id' in scenarioConfig === false){
            scenarioConfig.id = `scenario_${++scenarioIdCounter}`;
        }

        // generate timeline instance if it doesn't exist yet
        if (scenarioConfig.timeline && !timelines[scenarioConfig.timeline]){
            timelines[scenarioConfig.timeline] = new TimelineMax({
                autoRemoveChildren: true
            });
        }

        // save the scenario to the global scenarios
        if (scenarioConfig.id in scenarios){
            error(`scenario with id ${scenarioConfig.id} already exists. It will be overwritten!`)
        } else {
            scenarios[scenarioConfig.id] = scenarioConfig;
        }
    });

    return class AnimatedComponent extends React.Component {

        /**
         *  @typedef AnimationConfig
         *  @type {string | object | function)}
         *
         *  @example <caption>string</caption>
         *  'fadeIn'
         *
         *  @example <caption>Array of strings</caption>
         *  ['fadeIn', 'expand']
         *
         *  @example <caption>object</caption>
         *  {
         *      animation: 'fadeIn',
         *      position: 'withPrev',
         *      immediate: false,
         *      onComplete: ()=>{}
         *  }
         *
         *  @example <caption>function</caption>
         *  A function that receives the context the AnimatedComponent running the animation and returns an AnimationConfig in object format
         *  animatedComponentInstance => {
         *      animation: 'fadeIn',
         *      position: '+=2',
         *  }
         */

        constructor(props){
            super(props);
            // if no displayName is specified, use 'AnimationComponent';
            const componentDisplayName = WrappedComponent.displayName?WrappedComponent.displayName:`AnimatedComponent`;
            this.animationComponentId = `${componentDisplayName}_${++componentIdCounter}`;
            components[this.animationComponentId] = {
                animations: {},
                runningAnimations: {},
                pendingAnimations: {},
                evaluatingAnimations: false,
                removeCandidate: false,
                instance: this
            };

            this.wrappedComponentRef = React.createRef();
        }

        // decide whether to animate this element
        // don't worry I know what I'm doing
        UNSAFE_componentWillUpdate(nextProps, nextState){
            // we're only interested in scenarios that have triggers
            const filteredScenarios = scenariosConfig.filter(scenariosConfig => 'trigger' in scenariosConfig);
            let matchedScenario;

            // if multiple scenarios are defined, we only run the first one reached
            filteredScenarios.some( scenarioConfig => {
                const scenarioTest = this.testScenario(scenarioConfig, this.props, nextProps);
                if (scenarioTest.result){
                    matchedScenario = scenarioTest;
                    return true;
                } 
                    return false
                

            });

            
            if (matchedScenario){
                // save this until componentDidUpdate
                this.matchedScenario = matchedScenario
            }

            components[this.animationComponentId].evaluatingAnimations = true;
            // when switching from shouldShow=true to false, we need to wait until all components finished
            // evaluating which animations are running in real-time so that the component does not get removed
            // from the DOM prematurely
            if (this.props.shouldShow && !nextProps.shouldShow){
                components[this.animationComponentId].removeCandidate = true;
            }
        }

        componentDidUpdate(prevProps, prevState){
            const {matchedScenario} = this;
            if (matchedScenario){
                delete this.matchedScenario;
                
                if (matchedScenario.firedTriggerConfig){
                    if (globalOptions.onScenarioTriggered) {
                        globalOptions.onScenarioTriggered(matchedScenario.scenarioConfig);
                    }
                    this.addScenarioAnimations(matchedScenario.scenarioConfig, prevProps, matchedScenario.firedTriggerConfig);
                }
            }

            components[this.animationComponentId].evaluatingAnimations = false;
            components[this.animationComponentId].removeCandidate = false
        }

        testScenario(scenarioConfig, prevProps, nextProps){
            // ensure we have triggers as an array
            const triggerArray = Array.isArray(scenarioConfig.trigger) ? scenarioConfig.trigger : [scenarioConfig.trigger];
            // find the first trigger that fires (no need to find further triggers - because the scenario is either triggered or not)
            const firedTriggerConfig = triggerArray.find(triggerConfig => this.testTrigger(triggerConfig, prevProps, nextProps) );

            return {
                result: firedTriggerConfig !== undefined,
                scenarioConfig,
                firedTriggerConfig
            }
        }

        testTrigger(triggerConfig, prevProps, nextProps){
            if (typeof triggerConfig === 'object'){
                return triggerConfig.select(prevProps) === triggerConfig.value &&
                    triggerConfig.select(nextProps) === triggerConfig.nextValue;
            }
            if (typeof triggerConfig === 'function'){
                return triggerConfig(this.wrappedComponentRef.current, prevProps, nextProps);
            }
        }

        addScenarioAnimations(scenarioConfig, prevProps, triggerConfig){
            const timeline = timelines[scenarioConfig.timeline || 'master'];
            if (scenarioConfig.interrupt){
                timeline.progress(1, false);
            }

            // scenarios that are triggered can resolve functions to return animation config in runtime
            const scenarioConfigDraft = {...scenarioConfig};
            if (typeof scenarioConfigDraft.animations === 'function'){
                scenarioConfigDraft.animations = scenarioConfig.animations(this.wrappedComponentRef.current, prevProps)
            }

            addScenarioAnimations(scenarioConfigDraft , {
                thisContext: this,
                triggerConfig
            });
        }

        /**
         *
         * @param {AnimationConfig | AnimationConfig[])} animations
         * @param timelineOrTimelineId
         */
        addAnimation(animations, timelineOrTimelineId, options = {}) {
            const componentData = components[this.animationComponentId];

            // for convenience we assume we have an array of AnimationConfigs
            const animationConfigArray = Array.isArray(animations) ? animations : [animations];
            animationConfigArray.forEach((rawAnimationConfig, index) => {
                const animationConfig = transformAnimationConfig(rawAnimationConfig, this);
                const animationData = componentData.animations[animationConfig.animation];
                if (!animationData) {
                    error(`No such animation "${animationConfig.animation}" for component "${this.animationComponentId}". Perhaps you meant to call the global addAnimation?`)
                    return;
                }
                const animationTlToAdd = animationData.generatorFunc(animationData.elementRef, animationConfig.animationOptions);

                // figure out which timeline
                let timeline;
                if (typeof timelineOrTimelineId  === 'undefined' || timelineOrTimelineId === null){
                    timeline = timelines.master;
                } else if (typeof timelineOrTimelineId === 'string'){
                    timeline = timelines[timelineOrTimelineId];
                } else if (typeof timelineOrTimelineId === 'object'){
                    timeline = timelineOrTimelineId
                }

                // actual animation start will happen in future cycles, for now we want to mark this component as animating
                components[this.animationComponentId].pendingAnimations[animationConfig.id] = true;

                function attachCallbackToTl(callbackType, callbackFunction, params){
                    const references = {
                        animationComponent: componentData.instance.wrappedComponentRef.current
                    };

                    if (options.thisContext){
                        references.triggerComponent = options.thisContext.wrappedComponentRef.current
                    }

                    function gsapCallback(tweenRef){
                        // save the tweenref, as GSAP only passes it via string {self} string replacement
                        references.tween = tweenRef;
                        let callbackArgs = [references];
                        if (params) {
                            callbackArgs = [...callbackArgs, ...params];
                        }
                        
                        callbackFunction.apply(callbackArgs);
                    }

                    animationTlToAdd.eventCallback(callbackType, gsapCallback, ['{self}']);
                }

                attachCallbackToTl("onStart", (...args) => {
                    components[this.animationComponentId].runningAnimations[animationConfig.id] = true;
                    delete components[this.animationComponentId].pendingAnimations[animationConfig.id];

                    if (animationConfig.onStart){
                        animationConfig.onStart(...args);
                    }

                    if (options.firstAnimationInScenario){
                        if (options.scenarioConfig && globalOptions.onScenarioStart) {
                            globalOptions.onScenarioStart.apply([...args, options.scenarioConfig, options.triggerConfig]);
                        }
                    }

                });

                attachCallbackToTl("onComplete", (...args)=>{
                    delete components[this.animationComponentId].runningAnimations[animationConfig.id];

                    if (animationConfig.onComplete){
                        animationConfig.onComplete(...args);
                    }

                    // force the react component to re-render, in case we need to remove it from the DOM
                    this.forceUpdate();

                    if (options.lastAnimationInScenario){
                        if (options.scenarioConfig && globalOptions.onScenarioComplete) {
                            globalOptions.onScenarioComplete.apply([...args, options.scenarioConfig, options.triggerConfig]);
                        }
                    }
                });


                // "immediate" in config makes the timeline animation instantaneous
                if (animationConfig.immediate){
                    animationTlToAdd.duration(0.001);
                }

                // special case for starting an animation with the previous one
                if (animationConfig.position === 'withPrev'){
                    let newPosition = 0;
                    const timelineChildren = timeline.getChildren(false);
                    if (timelineChildren.length > 0) {
                        const previousTimeline = timelineChildren[timelineChildren.length - 1];
                        newPosition = previousTimeline.startTime();
                    }
                    animationConfig.position = newPosition;
                }
                timeline.add(animationTlToAdd, animationConfig.position);
            })
        }

        registerAnimation(animationId, generatorFunc, elementRef) {
            const componentAnimations = components[this.animationComponentId].animations;
            
            if (animationId in componentAnimations){
                error(`animationId ${animationId} already registered`);
            }
            else{
                componentAnimations[animationId] = {
                    generatorFunc,
                    elementRef,
                };


            }
        }

        getScenarios(){
            return scenariosConfig;
        }

        render(){
            const augmentedProps = {
                ...this.props,
                registerAnimation: this.registerAnimation.bind(this),
                addAnimation: this.addAnimation.bind(this)
            };

            const component = components[this.animationComponentId];
            const shouldShowInProps = 'shouldShow' in this.props;
            // if shouldShow is specified, then component will be displayed as long as it has a running animation
            const hasRunningAnimations = Object.values(component.runningAnimations).length>0;
            const hasPendingAnimations = Object.values(component.pendingAnimations).length>0;
            const isRemoveCandidate = component.removeCandidate;
            const isSomeComponentEvaluatingAnimations = Object.values(components).some(component=> component.evaluatingAnimations);

            if (shouldShowInProps === false ||
                (shouldShowInProps &&
                    (this.props.shouldShow === true ||
                        hasRunningAnimations ||
                        hasPendingAnimations ||
                        (isRemoveCandidate && isSomeComponentEvaluatingAnimations)
                    ))){
                return <WrappedComponent ref={this.wrappedComponentRef} { ...augmentedProps} />;
            } 
                    return null;
            
        }
    };
}

/**
 *
 * @param {animationConfig | animationConfig[] } animationConfig
 * @param timelineOrTimelineId
 * @param {objects} options
 */
function addAnimation(animations, timelineOrTimelineId, options = {}) {
    // for convenience we assume we have an array of AnimationConfigs
    const animationConfigArray = Array.isArray(animations) ? animations : [animations];

    animationConfigArray.forEach((rawAnimationConfig, animationIndex) => {
        const animationConfig = transformAnimationConfig(rawAnimationConfig, options.thisContext);
        // search for components with this animationId
        const componentsWithAnimation = Object.values(components).filter(
            componentData => animationConfig.animation in componentData.animations
        );

        if (componentsWithAnimation.length > 0){
            componentsWithAnimation.forEach((componentData, componentIndex) => {
                options = {
                    ...options,
                    // the first animation on the first component
                    firstAnimationInScenario: animationIndex === 0 && componentIndex === 0,
                    // the last animation on the last component
                    lastAnimationInScenario: animationIndex === (animationConfigArray.length -1) && componentIndex === (componentsWithAnimation.length - 1)
                };
                componentData.instance.addAnimation(animationConfig, timelineOrTimelineId, options)
            })
        } else{
            error(`no components with such animation ${animationConfig.animation}. Did you forget to call registerAnimation()?`)
        }
    });

}

function addScenarioAnimations(scenarioConfig, options = {}){
    const scenarioConfigDraft = {...scenarioConfig};

    // use master timeline in scenario configs with no timeline specified
    if ('timeline' in scenarioConfigDraft === false){
        scenarioConfigDraft.timeline = 'master';
    }

    // make sure 'animations' is an array
    let animations;
    if (Array.isArray(scenarioConfigDraft.animations)){
        animations = scenarioConfigDraft.animations;
    } else if (typeof scenarioConfigDraft.animations === 'string'){
        animations = [scenarioConfigDraft.animations];
    }

    addAnimation(animations, scenarioConfigDraft.timeline, {
        ...options,
        scenarioConfig: scenarioConfigDraft
    });
}

function triggerScenario(scenarioId){
    if (scenarios[scenarioId]){
        addScenarioAnimations(scenarios[scenarioId])
    } else {
        error(`can't trigger scenario ${scenarioId}, no such scenario defined`);
    }
}

function setGlobalOptions(options){
    globalOptions = options;
}

/**
 * Private functions
 */

// gets an animationID, a function or a config and transforms it to a proper to feed to the run animation function
function transformAnimationConfig(inputAnimationConfig, thisContext){
    // avoid double transformation
    if (inputAnimationConfig.__transformed) {
        return inputAnimationConfig
    };

    let animationConfig;
    if (typeof inputAnimationConfig === 'string'){
        animationConfig = {
            animation: inputAnimationConfig
        }
    }
    else if (typeof inputAnimationConfig === 'function') {
        if (thisContext && thisContext.animationComponentId){
            const funcResult = inputAnimationConfig.call(thisContext.wrappedComponentRef.current);
            if (typeof funcResult === 'string'){
                animationConfig = {
                    animation: funcResult
                }

            } else if (funcResult === null || typeof funcResult === 'undefined'){
                error('animation config function returned null or undefined');
            } else {
                // function returned object
                animationConfig = funcResult;
            }
        } else {
            error(`Can't evaluate animation config without a "this" context`);
        }
    }
    else{
        animationConfig = inputAnimationConfig;
    }

    // defaults
    animationConfig =
        {
            id : ++animationIdCounter,
            position: "+=0",
            ...animationConfig,
            __transformed: true
        };

    return animationConfig;
}

function error(message){
    console.error(`AnimationOrchestrator: ${message}`);
}


export {
    attachAnimation,
    addAnimation,
    triggerScenario,
    setGlobalOptions
}