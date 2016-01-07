/*global define*/
define([
    '../../Core/defined',
    '../../Core/defineProperties',
    '../../Core/destroyObject',
    '../../Core/DeveloperError',
    '../../Core/FeatureDetection',
    '../../ThirdParty/knockout',
    '../getElement',
    './PathQueryViewModel'
], function(
    defined,
    defineProperties,
    destroyObject,
    DeveloperError,
    FeatureDetection,
    knockout,
    getElement,
    PathQueryViewModel) {
    "use strict";

    /**
     * A widget for query the path between start location and end location on supermap online, and flying the camera to them.
     *
     * @alias PathQuery
     * @constructor
     *
     * @param {Element|String} container The DOM element or ID that will contain the widget.
     * @param {viewer} viewer The viewer instance to use.
     */
    var PathQuery = function(container,viewer) {

        //>>includeStart('debug', pragmas.debug);
        if (!defined(container)) {
            throw new DeveloperError('container is required.');
        }
        //>>includeEnd('debug');
        container = getElement(container);
        var viewModel = new PathQueryViewModel(viewer);
        var btnTogglePanel = document.createElement('button');
        btnTogglePanel.innerText = 'query';
        btnTogglePanel.className = 'cesium-button';
        btnTogglePanel.setAttribute('data-bind','click : toggleDropDownPanel');
        container.appendChild(btnTogglePanel);
        var form = document.createElement('form');
        form.className = 'dropDownPanelVisibleNone';
        form.setAttribute('data-bind','submit : queryPathHandler,css : {dropDownPanelVisible : dropDownPanelVisible}');
        container.appendChild(form);
        var startContainer = document.createElement('div');
        startContainer.className = 'startLocationContainer';
        form.appendChild(startContainer);
        var startInput = document.createElement('input');
        startInput.className = 'locationInput';
        startInput.setAttribute('type','search');
        startInput.setAttribute('placeholder','Enter start location...');
        startInput.setAttribute('data-bind','value : startLocation,valueUpdate : "afterkeydown" ');
        startContainer.appendChild(startInput);
        var startResultPanel = document.createElement('ul');
        startResultPanel.className = 'startLocationResultPanel';
        startResultPanel.setAttribute('data-bind','visible : startLocationSet.length > 0,foreach : startLocationSet');
        startContainer.appendChild(startResultPanel);
        var startLocationLi = document.createElement('li');
        startLocationLi.setAttribute('data-bind','click : $parent.startLocationSelHandler');
        startResultPanel.appendChild(startLocationLi);
        var startLocatioinSpan = document.createElement('span');
        startLocatioinSpan.setAttribute('data-bind','text : $index');
        startLocationLi.appendChild(startLocatioinSpan);
        var startLocatioinSpan2 = document.createElement('span');
        startLocatioinSpan2.setAttribute('data-bind','text : name');
        startLocationLi.appendChild(startLocatioinSpan2);
        var endContainer = document.createElement('div');
        endContainer.className = 'endLocationContainer';
        form.appendChild(endContainer);
        var endInput = document.createElement('input');
        endInput.className = 'locationInput';
        endInput.setAttribute('type','search');
        endInput.setAttribute('placeholder','Enter end location...');
        endInput.setAttribute('data-bind','value : endLocation,valueUpdate : "afterkeydown" ');
        endContainer.appendChild(endInput);
        var endResultPanel = document.createElement('ul');
        endResultPanel.className = 'endLocationResultPanel';
        endResultPanel.setAttribute('data-bind','visible : endLocationSet.length > 0,foreach : endLocationSet');
        endContainer.appendChild(endResultPanel);
        var endLocatioinLi = document.createElement('li');
        endLocatioinLi.setAttribute('data-bind','click : $parent.endLocationSelHandler');
        endResultPanel.appendChild(endLocatioinLi);
        var endLocationSpan = document.createElement('span');
        endLocationSpan.setAttribute('data-bind','text : $index');
        endLocatioinLi.appendChild(endLocationSpan);
        var endLocationSpan2 = document.createElement('span');
        endLocationSpan2.setAttribute('data-bind','text : name');
        endLocatioinLi.appendChild(endLocationSpan2);
        var submitBtn = document.createElement('button');
        submitBtn.type = 'submit';
        submitBtn.innerText = 'submit';
        submitBtn.setAttribute('data-bind','submit : queryPathHandler');
        submitBtn.className = 'submitBtn';
        form.appendChild(submitBtn);
        knockout.applyBindings(viewModel, container);

        this._container = container;
        this._viewModel = viewModel;
        this._form = form;
        this._btnTogglePanel = btnTogglePanel;
    };

    defineProperties(PathQuery.prototype, {
        /**
         * Gets the parent container.
         * @memberof Geocoder.prototype
         *
         * @type {Element}
         */
        container : {
            get : function() {
                return this._container;
            }
        },

        /**
         * Gets the view model.
         * @memberof Geocoder.prototype
         *
         * @type {GeocoderViewModel}
         */
        viewModel : {
            get : function() {
                return this._viewModel;
            }
        }
    });

    /**
     * @returns {Boolean} true if the object has been destroyed, false otherwise.
     */
    PathQuery.prototype.isDestroyed = function() {
        return false;
    };

    /**
     * Destroys the widget.  Should be called if permanently
     * removing the widget from layout.
     */
    PathQuery.prototype.destroy = function() {
        knockout.cleanNode(this._container);
        this._container.removeChild(this._form);
        this._container.removeChild(this._btnTogglePanel);
        return destroyObject(this);
    };

    return PathQuery;
});
