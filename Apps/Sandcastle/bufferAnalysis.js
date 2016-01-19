function startup(Cesium) {
    "use strict";
//Sandcastle_Begin
    var viewer = new Cesium.Viewer('cesiumContainer',{
        imageryProvider : new Cesium.SingleTileImageryProvider({
            url : '../../SampleData/GlobalBkLayer.jpg'
        })
    });

    var scene = viewer.scene;
    var ellipsoid = scene.globe.ellipsoid;
    var handlerLine = new Cesium.PolylineHandler(scene),
        handlerPolygon = new Cesium.PolygonHandler(scene),
        currentPolyline,
        currentPolygon;
    handlerLine.drawCompletedEvent.addEventListener(function(polyline){
        currentPolyline = polyline;
    },handlerLine);
    handlerPolygon.drawCompletedEvent.addEventListener(function(polygon){
        currentPolygon = polygon;
    },handlerPolygon);
    function convertPolyline(polyline){
        var result = Cesium.cesiumToSuperMap.convertPolyline(polyline,ellipsoid);
        if(result !== undefined){
            var points = [];
            for(var i = 0,j = result.length;i < j;i++){
                var obj = result[i];
                points.push(new SuperMap.Geometry.Point(obj.x,obj.y));
            }
            var line = new SuperMap.Geometry.LineString(points);
            return line;
        }
        return undefined;
    }
    function convertPolygon(polygon){
        var result = Cesium.cesiumToSuperMap.convertPolygon(polygon,ellipsoid);
        if(result !== undefined){
            var points = [];
            for(var i = 0,j = result.length;i < j;i++){
                var obj = result[i];
                points.push(new SuperMap.Geometry.Point(obj.x,obj.y));
            }
            var linearRings = new SuperMap.Geometry.LinearRing(points);
            var region = new SuperMap.Geometry.Polygon([linearRings]);
            return region;
        }
        return undefined;
    }
    //绘制polyline
    Sandcastle.addToolbarButton('draw polyline', function() {
        handlerPolygon.deactivate();
        if(handlerLine.active){
            handlerLine.deactivate();
        }
        else{
            handlerLine.activate();
        }
    });
    //绘制polygon
    Sandcastle.addToolbarButton('draw polygon', function() {
        handlerLine.deactivate();
        if(handlerPolygon.active){
            handlerPolygon.deactivate();
        }
        else{
            handlerPolygon.activate();
        }
    });
    //生成polyline的缓冲区
    var url = "http://localhost:8090/iserver/services/spatialanalyst-changchun/restjsr/spatialanalyst";
    function bufferAnalystCompleted(BufferAnalystEventArgs) {
        var bufferResultGeometry = BufferAnalystEventArgs.result.resultGeometry;
        if(bufferResultGeometry !== undefined && bufferResultGeometry !== null){
            var polygonEntity = Cesium.supermapToCesium.convertPolygon(bufferResultGeometry);
            polygonEntity.polygon.material = Cesium.Color.BLUE.withAlpha(0.5);
            viewer.entities.add(polygonEntity);
        }
    }
    Sandcastle.addToolbarButton('polyline buffer analysis', function() {
        if(!handlerLine.active){
            if(currentPolyline !== undefined){
                var lineString = convertPolyline(currentPolyline);
                if(lineString !== undefined){
                    var bufferServiceByGeometry = new SuperMap.REST.BufferAnalystService(url);
                    var bufferDistance = new SuperMap.REST.BufferDistance({
                        value: 0.1
                    });
                    var bufferSetting = new SuperMap.REST.BufferSetting({
                        endType: SuperMap.REST.BufferEndType.ROUND,
                        leftDistance: bufferDistance,
                        rightDistance: bufferDistance,
                        semicircleLineSegment: 10
                    });
                    var geoBufferAnalystParam = new SuperMap.REST.GeometryBufferAnalystParameters({
                        sourceGeometry: lineString,
                        bufferSetting: bufferSetting
                    });
                    bufferServiceByGeometry.events.on({
                        "processCompleted": bufferAnalystCompleted
                    });
                    bufferServiceByGeometry.processAsync(geoBufferAnalystParam);
                }
            }
        }
    });
    //生成polygon的缓冲区
    Sandcastle.addToolbarButton('polygon buffer analysis', function() {
        if(!handlerPolygon.active){
            if(currentPolygon !== undefined){
                var polygon = convertPolygon(currentPolygon);
                if(polygon !== undefined){
                    var bufferServiceByGeometry = new SuperMap.REST.BufferAnalystService(url);
                    var bufferDistance = new SuperMap.REST.BufferDistance({
                        value: 0.1
                    });
                    var bufferSetting = new SuperMap.REST.BufferSetting({
                        endType: SuperMap.REST.BufferEndType.ROUND,
                        leftDistance: bufferDistance,
                        rightDistance: bufferDistance,
                        semicircleLineSegment: 10
                    });
                    var geoBufferAnalystParam = new SuperMap.REST.GeometryBufferAnalystParameters({
                        sourceGeometry: polygon,
                        bufferSetting: bufferSetting
                    });
                    bufferServiceByGeometry.events.on({
                        "processCompleted": bufferAnalystCompleted
                    });
                    bufferServiceByGeometry.processAsync(geoBufferAnalystParam);
                }
            }
        }
    });
//Sandcastle_End
    Sandcastle.finishedLoading();
}
if (typeof Cesium !== "undefined") {
    startup(Cesium);
} else if (typeof require === "function") {
    require(["Cesium"], startup);
}