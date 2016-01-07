/*global define*/
define([
    '../Core/Event',
    '../Core/defined',
    '../Core/DeveloperError',
    '../Core/getFilenameFromUri',
    '../ThirdParty/when',
    './EntityCollection',
    '../Core/loadJson',
    '../Core/Color',
    '../Core/Cartesian3',
    './PolylineGraphics',
    './ColorMaterialProperty',
    './ConstantProperty',
    './Entity'
], function(
    Event,defined,DeveloperError,getFilenameFromUri,when,EntityCollection,loadJson,Color,Cartesian3,PolylineGraphics,ColorMaterialProperty,ConstantProperty,Entity) {
    "use strict";
    var StatisticsDataSource = function(){
        this._name = undefined;
        this._changed = new Event();
        this._error = new Event();
        this._isLoading = false;
        this._loading = new Event();
        this._entityCollection = new EntityCollection();
        this._seriesNames = [];
        this._seriesToDisplay = undefined;
        this._heightScale = 5000000;
    };
    Object.defineProperties(StatisticsDataSource.prototype, {
        //The below properties must be implemented by all DataSource instances

        /**
         * Gets a human-readable name for this instance.
         * @memberof WebGLGlobeDataSource.prototype
         * @type {String}
         */
        name : {
            get : function() {
                return this._name;
            }
        },
        /**
         * Since WebGL Globe JSON is not time-dynamic, this property is always undefined.
         * @memberof WebGLGlobeDataSource.prototype
         * @type {DataSourceClock}
         */
        clock : {
            value : undefined,
            writable : false
        },
        /**
         * Gets the collection of Entity instances.
         * @memberof WebGLGlobeDataSource.prototype
         * @type {EntityCollection}
         */
        entities : {
            get : function() {
                return this._entityCollection;
            }
        },
        /**
         * Gets a value indicating if the data source is currently loading data.
         * @memberof WebGLGlobeDataSource.prototype
         * @type {Boolean}
         */
        isLoading : {
            get : function() {
                return this._isLoading;
            }
        },
        /**
         * Gets an event that will be raised when the underlying data changes.
         * @memberof WebGLGlobeDataSource.prototype
         * @type {Event}
         */
        changedEvent : {
            get : function() {
                return this._changed;
            }
        },
        /**
         * Gets an event that will be raised if an error is encountered during
         * processing.
         * @memberof WebGLGlobeDataSource.prototype
         * @type {Event}
         */
        errorEvent : {
            get : function() {
                return this._error;
            }
        },
        /**
         * Gets an event that will be raised when the data source either starts or
         * stops loading.
         * @memberof WebGLGlobeDataSource.prototype
         * @type {Event}
         */
        loadingEvent : {
            get : function() {
                return this._loading;
            }
        },

        //These properties are specific to this DataSource.

        /**
         * Gets the array of series names.
         * @memberof WebGLGlobeDataSource.prototype
         * @type {String[]}
         */
        seriesNames : {
            get : function() {
                return this._seriesNames;
            }
        },
        /**
         * Gets or sets the name of the series to display.  WebGL JSON is designed
         * so that only one series is viewed at a time.  Valid values are defined
         * in the seriesNames property.
         * @memberof WebGLGlobeDataSource.prototype
         * @type {String}
         */
        seriesToDisplay : {
            get : function() {
                return this._seriesToDisplay;
            },
            set : function(value) {
                this._seriesToDisplay = value;

                //Iterate over all entities and set their show property
                //to true only if they are part of the current series.
                var collection = this._entityCollection;
                var entities = collection.values;
                collection.suspendEvents();
                for (var i = 0; i < entities.length; i++) {
                    var entity = entities[i];
                    entity.show = value === entity.seriesName;
                }
                collection.resumeEvents();
            }
        },
        /**
         * Gets or sets the scale factor applied to the height of each line.
         * @memberof WebGLGlobeDataSource.prototype
         * @type {Number}
         */
        heightScale : {
            get : function() {
                return this._heightScale;
            },
            set : function(value) {
                if (value < 0) {
                    throw new DeveloperError('value must be greater than 0');
                }
                this._heightScale = value;
            }
        }
    });
    /**
     * Asynchronously loads the GeoJSON at the provided url, replacing any existing data.
     * @param {Object} url The url to be processed.
     * @returns {Promise} a promise that will resolve when the GeoJSON is loaded.
     */
    StatisticsDataSource.prototype.loadUrl = function(url) {
        if (!defined(url)) {
            throw new DeveloperError('url is required.');
        }

        //Create a name based on the url
        var name = getFilenameFromUri(url);

        //Set the name if it is different than the current name.
        if (this._name !== name) {
            this._name = name;
            this._changed.raiseEvent(this);
        }

        //Use 'when' to load the URL into a json object
        //and then process is with the `load` function.
        var that = this;
        return when(loadJson(url), function(json) {
            return that.load(json, url);
        }).otherwise(function(error) {
            //Otherwise will catch any errors or exceptions that occur
            //during the promise processing. When this happens,
            //we raise the error event and reject the promise.
            this._setLoading(false);
            that._error.raiseEvent(that, error);
            return when.reject(error);
        });
    };
    /**
     * Loads the provided data, replacing any existing data.
     * @param {Object} data The object to be processed.
     */
    StatisticsDataSource.prototype.load = function(data,options) {
        //>>includeStart('debug', pragmas.debug);
        if (!defined(data)) {
            throw new DeveloperError('data is required.');
        }
        //>>includeEnd('debug');

        //Clear out any data that might already exist.

        options = options || {};
        var beginColor = options.beginColor || new Color(0,0,1,1);
        var endColor = options.endColor || new Color(1,0,0,1);
        var width = options.width || 2;
        width = width > 10 ? 10 : width;
        var dColor = {
            red : endColor.red - beginColor.red,
            green : endColor.green - beginColor.green,
            blue : endColor.blue - beginColor.blue
        };

        this._setLoading(true);
        this._seriesNames.length = 0;
        this._seriesToDisplay = undefined;

        var heightScale = this.heightScale;
        var entities = this._entityCollection;

        //It's a good idea to suspend events when making changes to a
        //large amount of entities.  This will cause events to be batched up
        //into the minimal amount of function calls and all take place at the
        //end of processing (when resumeEvents is called).
        entities.suspendEvents();
        entities.removeAll();

        //WebGL Globe JSON is an array of series, where each series itself is an
        //array of two items, the first containing the series name and the second
        //being an array of repeating latitude, longitude, height values.
        //
        //Here's a more visual example.
        //[["series1",[latitude, longitude, height, ... ]
        // ["series2",[latitude, longitude, height, ... ]]

        // Loop over each series
        for (var x = 0; x < data.length; x++) {
            var series = data[x];
            var seriesName = series[0];
            var coordinates = series[1];

            //Add the name of the series to our list of possible values.
            this._seriesNames.push(seriesName);

            //Make the first series the visible one by default
            var show = x === 0;
            if (show) {
                this._seriesToDisplay = seriesName;
            }

            //Now loop over each coordinate in the series and create
            // our entities from the data.
            for (var i = 0; i < coordinates.length; i += 3) {
                var latitude = coordinates[i];
                var longitude = coordinates[i + 1];
                var height = coordinates[i + 2];

                //Ignore lines of zero height.
                if(height === 0) {
                    continue;
                }

                var factor = height*1 > 1 ? 1 : height*1;
                var color;
                if(defined(options.beginColor) && defined(options.endColor)){
                    color = new Color(beginColor.red + dColor.red*factor,beginColor.green + dColor.green*factor,beginColor.blue + dColor.blue*factor);
                }
                else{
                    color = Color.fromHsl((0.6 - height*0.5), 1.0, 0.5);
                }

                var surfacePosition = Cartesian3.fromDegrees(longitude, latitude, 0);
                var heightPosition = Cartesian3.fromDegrees(longitude, latitude, height * heightScale);

                //WebGL Globe only contains lines, so that's the only graphics we create.
                var polyline = new PolylineGraphics();
                polyline.material = new ColorMaterialProperty(color);
                polyline.width = new ConstantProperty(2);
                polyline.followSurface = new ConstantProperty(false);
                polyline.positions = new ConstantProperty([surfacePosition, heightPosition]);

                //The polyline instance itself needs to be on an entity.
                var entity = new Entity({
                    id : seriesName + ' index ' + i.toString(),
                    show : show,
                    polyline : polyline,
                    seriesName : seriesName //Custom property to indicate series name
                });

                //Add the entity to the collection.
                entities.add(entity);
            }
        }

        //Once all data is processed, call resumeEvents and raise the changed event.
        entities.resumeEvents();
        this._changed.raiseEvent(this);
        this._setLoading(false);
    };
    //example data=[lon,lat,value]
    StatisticsDataSource.prototype.loadArrayData = function(data,options) {
        //>>includeStart('debug', pragmas.debug);
        if (!defined(data)) {
            throw new DeveloperError('data is required.');
        }
        //>>includeEnd('debug');
        options = options || {};
        var beginColor = options.beginColor || new Color(0,0,1,1);
        var endColor = options.endColor || new Color(1,0,0,1);
        var width = options.width || 2;
        width = width > 10 ? 10 : width;
        var dColor = {
            red : endColor.red - beginColor.red,
            green : endColor.green - beginColor.green,
            blue : endColor.blue - beginColor.blue
        };
        //Clear out any data that might already exist.
        this._seriesNames.length = 0;
        this._seriesToDisplay = undefined;

        var heightScale = this.heightScale;
        var entities = this._entityCollection;
        for (var i = 0; i < data.length; i += 3) {
            var latitude = data[i];
            var longitude = data[i + 1];
            var height = data[i + 2];

            //Ignore lines of zero height.
            if(height === 0) {
                continue;
            }

            var factor = height*10 > 1 ? 1 : height*10;
            var color;
            if(defined(options.beginColor) && defined(options.endColor)){
                color = new Color(beginColor.red + dColor.red*factor,beginColor.green + dColor.green*factor,beginColor.blue + dColor.blue*factor);
            }
            else{
                color = Color.fromHsl((0.6 - height*0.5), 1.0, 0.5);
            }
            var surfacePosition = Cartesian3.fromDegrees(longitude, latitude, 0);
            var heightPosition = Cartesian3.fromDegrees(longitude, latitude, height * heightScale * 5);

            //WebGL Globe only contains lines, so that's the only graphics we create.
            var polyline = new PolylineGraphics();
            polyline.material = new ColorMaterialProperty(color);
            polyline.width = new ConstantProperty(width);
            polyline.followSurface = new ConstantProperty(false);
            polyline.positions = new ConstantProperty([surfacePosition, heightPosition]);

            //The polyline instance itself needs to be on an entity.
            var entity = new Entity({
                id : ' index ' + i.toString(),
                show : true,
                polyline : polyline
            });

            //Add the entity to the collection.
            entities.add(entity);
        }

        //Once all data is processed, call resumeEvents and raise the changed event.
        entities.resumeEvents();
        this._changed.raiseEvent(this);
        this._setLoading(false);
    };
    StatisticsDataSource.prototype._setLoading = function(isLoading) {
        if (this._isLoading !== isLoading) {
            this._isLoading = isLoading;
            this._loading.raiseEvent(this, isLoading);
        }
    };
    return StatisticsDataSource;
});