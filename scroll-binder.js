(function ($, exports, window, document) {
  'use strict';

  var module;

  // This will be a singleton, so module manages the instance
  module = {
    instance: null,
    key: 'SCROLL_BINDER'
  };

  /**
   * Get singleton instance or create it if non-existent
   */
  exports.init = function ($element, options) {
    if (module.instance === null) {
      module.instance = new ScrollBinder($element, options);
    }

    return module.instance;
  };

  /**
   * Destroy ScrollBinder singleton
   */
  exports.destroy = function () {
    if (module.instance === null) {
      return;
    }

    module.instance.reset().unbind();
    module.instance = null;
  };

  /**
   * A nice header that collapses when scrolling down the page
   *
   * @constructor
   * @name ScrollBinder
   */
  function ScrollBinder($element, options) {
    options = options || {};

    /**
     * Parent for all animated elements
     * @type {Object} Must be jQuery object
     */
    this.$element = $element || $(document.body);

    /**
     * Total scrolling distance / duration of the animation
     * @type {int}
     */
    this.scrollDistance = options.over || 70;

    /**
     * Animation definitions. Key: selector, value: object with css properties and from/to values
     * @type {Object}
     */
    this.animations = (typeof options.animations === 'object') ? options.animations : {};

    // @fixme - These two should not be public
    this.scrollFlag = true;
    this.scrollEnd = null;

    // @todo - More extensive or other solution
    this.transforms = ['scale', 'scaleX', 'scaleY', 'rotate', 'rotateX', 'rotateY', 'rotateZ', 'translateX', 'translateY'];

    this.init().bind();
  }

  /**
   * Init everything
   * @return {ScrollBinder} Instance for chainability
   */
  ScrollBinder.prototype.init = function () {
    this.initAnimations();
    return this;
  };

  /**
   * Bind all event handlers for this module
   * @return {ScrollBinder} Instance for chainability
   */
  ScrollBinder.prototype.bind = function () {
    $(window).on('scroll.' + module.instanceKey, $.proxy(this.onScroll, this));
    return this;
  };

  /**
   * Reset module to its primary state
   * @return {ScrollBinder} Instance for chainability
   */
  ScrollBinder.prototype.reset = function () {
    return this;
  };

  /**
   * Unbind all handlers
   * @return {ScrollBinder} Instance for chainability
   */
  ScrollBinder.prototype.unbind = function () {
    $(window).off('scroll.' + module.instanceKey);
    return this;
  };

  /**
   * Initialize all animations from user input to usable objects
   * @return {Object} All initiated animations
   */
  ScrollBinder.prototype.initAnimations = function () {
    var initAnimations = {};

    // Loop all selectors
    for (var selector in this.animations) {
      if (this.animations.hasOwnProperty(selector)) {
        initAnimations[selector] = this.initSelector(selector, this.animations[selector]);
      }
    }

    // Override user specified animations with initialized animations
    this.animations = initAnimations;

    return this.animations;
  };

  ScrollBinder.prototype.initSelector = function (selector, properties) {
    // Create a new object that will hold all initialized values
    var init = { init: true, $element: null, properties: {} };

    // Cache the targeted element
    // We can select the parent element by using this instead of a selector
    if (selector === 'this') {
      init.$element = this.$element;
    } else {
      init.$element = this.$element.find(selector);
    }

    // Loop all CSS properties for current selector
    for (var property in properties) {
      if (properties.hasOwnProperty(property)) {
        init.properties[property] = this.initProperty(property, properties[property], init.$element);
      }
    }

    return init;
  };

  ScrollBinder.prototype.initProperty = function (property, value, $element) {
    var isTransform = ($.inArray(property, this.transforms) !== -1),
        from        = value.from,
        to          = value.to,
        over        = value.over || this.scrollDistance,
        unit        = (typeof value.unit === 'string') ? value.unit : ((!!isTransform) ? '' : 'px');

    // Inherit 'from'-value from the CSS if undefined
    if (typeof from === 'undefined') {
      from = parseFloat($element.css(property));

      if (isNaN(from)) {
        from = 0;
      }
    }

    // Inherit 'to'-value from the CSS if undefined
    if (typeof to === 'undefined') {
      to = parseFloat($element.css(property));

      if (isNaN(to)) {
        to = 0;
      }
    }

    // Construct the animation function for this property and attach it to the initialized object
    return {
      fn: this.buildPropertyFunction(from, to, over),
      isTransform: ($.inArray(property, this.transforms) !== -1),
      unit: unit
    };
  };

  /**
   * Build a function that takes a scroll position and returns the current value for a certain property
   * Compare it to a simple algebra function like y = 2x where x would be the scroll position
   *
   * @param  {int} from    Default property value (scrollPos = 0)
   * @param  {int} to      Maximum property value (scrollPos = max)
   * @param  {int} over    Maximum scrolling distance
   * @return {Function}    Funtion that takes current scroll position as an argument and returns the property value
   */
  ScrollBinder.prototype.buildPropertyFunction = function(from, to, over) {
    return function (scrollPos) {
      var newValue = Math.round((from + (to - from) * scrollPos / over) * 100 ) / 100;

      // Force newValue between from and to (if check is for negative numbers (like between -55 and -10))
      if (from < to) {
        newValue = (newValue < from) ? from : (newValue > to) ? to : newValue;
      } else {
        newValue = (newValue > from) ? from : (newValue < to) ? to : newValue;
      }

      return newValue;
    };
  };

  ScrollBinder.prototype.requestFrame = (function () {
    return window.requestAnimationFrame       ||
           window.webkitRequestAnimationFrame ||
           window.mozRequestAnimationFrame    ||
           function (callback) {
             window.setTimeout(callback, 1000 / 60);
           };
  })();

  /**
   * Animate all properties to their correct values for the given scrolling position
   * @param  {int} scrollPos
   * @return {void}
   */
  ScrollBinder.prototype.animate = function(scrollPos) {
    var self = this;

    this.requestFrame.call(window, function () {
      // Loop over all selectors
      for (var selector in self.animations) {
        if (self.animations.hasOwnProperty(selector)) {
          var animation = self.animations[selector],
              transformStack = {};

          // Loop all properties for the current selector
          for (var property in animation.properties) {
            if (animation.properties.hasOwnProperty(property)) {
              var value = animation.properties[property];

              // Transforms get temporarily stored in a stack because
              // we'll have to merge them into a single string to work
              if (!!value.isTransform) {
                transformStack[property] = value.fn(scrollPos) + value.unit;
              } else {
                animation.$element.css(property, value.fn(scrollPos) + value.unit);
              }
            }
          }

          // If one of the properties was a transform,
          // build a transform string like
          // scale(2.3) translateX(20px)
          if (!$.isEmptyObject(transformStack)) {
            var transformString = '';

            for (var transformProperty in transformStack) {
              if (transformStack.hasOwnProperty(transformProperty)) {
                transformString += transformProperty + '(' + transformStack[transformProperty] + ') ';
              }
            }


            animation.$element.css({
              '-webkit-transform': transformString,
              '-ms-transform'    : transformString,
              'transform'        : transformString
            });
          }
        }
      }
    });
  };

  /**
   * Handle scroll event
   * @return {void}
   */
  ScrollBinder.prototype.onScroll = function (e, fromScrollEnd) {
    var self = this,
        scrollTop = $(window).scrollTop();

    // scrollFlag throttles the requests
    if (this.scrollFlag === false) {
      return;
    }

    // scrollEnd gets triggered after last scroll event
    // since we're in a new scroll event, clear the one from the previous
    clearTimeout(self.scrollEnd);

    // Disable scroll listening
    this.scrollFlag = false;

    // Animate all properties
    this.animate(scrollTop);

    // Once per 16ms (= 1 frame at 60fps)
    setTimeout(function () {
      self.scrollFlag = true;
    }, 16);

    if (!fromScrollEnd) {
      this.scrollEnd = setTimeout(function () {
        self.onScroll(e, true);
      }, 64);
    }
  };

}(jQuery, exports, window, document, undefined));
