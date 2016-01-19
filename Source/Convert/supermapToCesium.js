/*global define*/
define([
    '../Core/Cartesian3',
    '../Core/definedNotNull',
    '../Core/DeveloperError'
],function(Cartesian3,definedNotNull,DeveloperError) {
    "use strict";

    /**
     * 把supermap iclient for javascript 的GEOMETRY类型转换为CESIUM可用的类型，用来构造entity
     * @type {{convertPoint: convertPoint, convertLineString: convertLineString, convertPolygon: convertPolygon}}
     */
    var supermapToCesium = {
        convertPoint : function(point){
            if(!definedNotNull(point)){
                throw new DeveloperError('point is required!');
            }
            var x = point.x;
            var y = point.y;
            if(definedNotNull(x) && definedNotNull(y)){
                return {
                    position : Cartesian3.fromDegrees(x,y),
                    point : {
                        pixelSize : 10
                    }
                }
            }
            return undefined;
        },
        convertLineString : function(lineString){
            if(!definedNotNull(lineString)){
                throw new DeveloperError('lineString is required!');
            }
            var points = lineString.getVertices();
            if(definedNotNull(points) && points instanceof Array && points.length > 2){
                var arr = [];
                for(var i = 0,j = points.length;i < j;i++){
                    var x = points[i].x;
                    var y = points[i].y;
                    if(definedNotNull(x) && definedNotNull(y)){
                        arr.push(x);
                        arr.push(y);
                    }
                }
                return {
                    polyline : {
                        positions : Cartesian3.fromDegreesArray(arr)
                    }
                }
            }
            return undefined;
        },
        convertPolygon : function(polygon){
            if(!definedNotNull(polygon)){
                throw new DeveloperError('polygon is required!');
            }
            var points = polygon.getVertices();
            if(definedNotNull(points) && points instanceof  Array && points.length > 2){
                var arr = [];
                for(var i = 0,j = points.length;i < j;i++){
                    var x = points[i].x;
                    var y = points[i].y;
                    if(definedNotNull(x) && definedNotNull(y)){
                        arr.push(x);
                        arr.push(y);
                    }
                }
                return {
                    polygon : {
                        hierarchy : Cartesian3.fromDegreesArray(arr)
                    }
                }
            }
            return undefined;
        }

    };
    return supermapToCesium;
});
