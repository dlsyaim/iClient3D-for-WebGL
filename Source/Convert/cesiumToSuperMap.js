/*global define*/
define([
    '../Core/Cartesian3',
    '../Core/definedNotNull',
    '../Core/DeveloperError',
    '../Core/Math'
],function(Cartesian3,definedNotNull,DeveloperError,Math) {
    "use strict";

    /**
     * 把CESIUM 的GEOMETRY类型转换为supermap iclient for javascript可用的类型
     * @type {{convertPoint: convertPoint, convertLineString: convertLineString, convertPolygon: convertPolygon}}
     */
    var cesiumToSuperMap = {
        convertPoint : function(point,ellipsoid){
            if(!definedNotNull(point) || !definedNotNull(ellipsoid)){
                throw new DeveloperError('point and ellipsoid are required!');
            }
            var lonlatPoint = ellipsoid.cartesianToCartographic(point);
            var x = Math.toDegrees(lonlatPoint.longitude);
            var y = Math.toDegrees(lonlatPoint.latitude);
            if(definedNotNull(x) && definedNotNull(y)){
                return {
                    x : x,
                    y : y
                }
            }
            return undefined;
        },
        convertPolyline : function(polyline,ellipsoid){
            if(!definedNotNull(polyline)){
                throw new DeveloperError('lineString is required!');
            }
            var points = polyline.positions;
            if(definedNotNull(points) && points instanceof Array && points.length > 2){
                var arr = [];
                for(var i = 0,j = points.length;i < j;i++){
                    var lonlat = this.convertPoint(points[i],ellipsoid);
                    if(definedNotNull(lonlat)){
                        arr.push({
                            x : lonlat.x,
                            y : lonlat.y
                        });
                    }
                }
                return arr;
            }
            return undefined;
        },
        convertPolygon : function(polygon,ellipsoid){
            if(!definedNotNull(polygon)){
                throw new DeveloperError('polygon is required!');
            }
            var points = polygon.positions;
            if(definedNotNull(points) && points instanceof  Array && points.length > 2){
                var arr = [];
                for(var i = 0,j = points.length;i < j;i++){
                    var lonlat = this.convertPoint(points[i],ellipsoid);
                    if(definedNotNull(lonlat)){
                        arr.push({
                            x : lonlat.x,
                            y : lonlat.y
                        });
                    }
                }
                return arr;
            }
            return undefined;
        }

    };
    return cesiumToSuperMap;
});
