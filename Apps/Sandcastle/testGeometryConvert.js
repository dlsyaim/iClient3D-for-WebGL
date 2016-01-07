function startup(Cesium) {
    "use strict";
//Sandcastle_Begin
    var viewer = new Cesium.Viewer('cesiumContainer',{
        /*imageryProvider : new Cesium.ArcGisMapServerImageryProvider({
         url: '//services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer'
         })*/
        imageryProvider : new Cesium.GoogleEarthImageryProvider({
            url : 'http://khm1.google.com/kh/v=189',
            channel : 1008
        }),
        geocoder : true,
        pathQuery : true
    });
    /*var point = new SuperMap.Geometry.Point(1,2);
    var points = [new SuperMap.Geometry.Point(4933.319287022352, -3337.3849141502124),
        new SuperMap.Geometry.Point(4960.9674060199022, -3349.3316322355736),
        new SuperMap.Geometry.Point(5006.0235999418364, -3358.8890067038628),
        new SuperMap.Geometry.Point(5075.3145648369318, -3378.0037556404409),
        new SuperMap.Geometry.Point(5305.19551436013, -3376.9669111768926)];

    var sourceProj = new proj4.Proj('EPSG:3857');
    var destProj = new proj4.Proj("EPSG:4326");
    for(var i = 0,j = points.length;i < j;i++){
        points[i] = proj4.transform(sourceProj, destProj, points[i]);
        console.log(points[i]);
    }
    var lineString = new SuperMap.Geometry.LineString(points);
    var entityLine = Cesium.convertGeometry.convertLineString(lineString);
    viewer.entities.add(entityLine);

    points = [new SuperMap.Geometry.Point(1.319287022352, -2.3849141502124),
        new SuperMap.Geometry.Point(3.9674060199022, -4.3316322355736),
        new SuperMap.Geometry.Point(5.0235999418364, -6.8890067038628),
        new SuperMap.Geometry.Point(6.3145648369318, -7.0037556404409),
        new SuperMap.Geometry.Point(8.19551436013, -9.9669111768926)];
    var roadLine = new SuperMap.Geometry.LineString(points);
    var entityPoint = Cesium.convertGeometry.convertPoint(point);
    viewer.entities.add(entityPoint);
    var entityLineString = Cesium.convertGeometry.convertLineString(roadLine);
    viewer.entities.add(entityLineString);

    points =[new SuperMap.Geometry.Point(0,10),
        new SuperMap.Geometry.Point(10,12),
        new SuperMap.Geometry.Point(13,14),
        new SuperMap.Geometry.Point(10,16)
    ];
    var linearRings = new SuperMap.Geometry.LinearRing(points);
    var region = new SuperMap.Geometry.Polygon([linearRings]);
    var polygonEntity = Cesium.convertGeometry.convertPolygon(region);
    viewer.entities.add(polygonEntity);*/


    //缓冲区分析
    var sourceProj = new proj4.Proj('EPSG:3857');
    var destProj = new proj4.Proj("EPSG:4326");
    var myPointsList = [new SuperMap.Geometry.Point(1.940, -2.000),
        new SuperMap.Geometry.Point(3.940, -4.301),
        new SuperMap.Geometry.Point(5.561, -6.125),
        new SuperMap.Geometry.Point(7.383, -8.158),
        new SuperMap.Geometry.Point(9.983, -10.291),
        new SuperMap.Geometry.Point(11.004, -12.027),
        new SuperMap.Geometry.Point(13.265, -14.939)
        ];
    var gpsLine = new SuperMap.Geometry.LineString(myPointsList);
    var length = gpsLine.getLength();
    var inPerDisplayUnit = SuperMap.INCHES_PER_UNIT['m'];
    if(inPerDisplayUnit) {
        var inPerMapUnit = SuperMap.INCHES_PER_UNIT['dd'];
        length *= (inPerMapUnit / inPerDisplayUnit);
    }
    viewer.entities.add({
        position : Cesium.Cartesian3.fromDegrees(13.265, -14.939),
        label : {
            text : length + "m",
            font : '24px Helvetica',
            fillColor : Cesium.Color.SKYBLUE,
            outlineColor : Cesium.Color.BLACK,
            outlineWidth : 2,
            style : Cesium.LabelStyle.FILL_AND_OUTLINE
        }
    });
    var entityLine = Cesium.convertGeometry.convertLineString(gpsLine);
    viewer.entities.add(entityLine);


    //对生成的线路进行缓冲区分析
    var url = "http://localhost:8090/iserver/services/spatialAnalysis-spatialAnalyst/restjsr/spatialanalyst";
    var bufferServiceByGeometry = new SuperMap.REST.BufferAnalystService(url),
        bufferDistance = new SuperMap.REST.BufferDistance({
            value: 0.1
        }),
        bufferSetting = new SuperMap.REST.BufferSetting({
            endType: SuperMap.REST.BufferEndType.ROUND,
            leftDistance: bufferDistance,
            rightDistance: bufferDistance,
            semicircleLineSegment: 10
        }),
        geoBufferAnalystParam = new SuperMap.REST.GeometryBufferAnalystParameters({
            sourceGeometry: gpsLine,
            bufferSetting: bufferSetting
        });

    bufferServiceByGeometry.events.on(
        {
            "processCompleted": bufferAnalystCompleted
        });
    bufferServiceByGeometry.processAsync(geoBufferAnalystParam);
    function bufferAnalystCompleted(BufferAnalystEventArgs) {
        var feature = new SuperMap.Feature.Vector();
        var bufferResultGeometry = BufferAnalystEventArgs.result.resultGeometry;
        var polygonEntity = Cesium.convertGeometry.convertPolygon(bufferResultGeometry);
        polygonEntity.polygon.material = Cesium.Color.BLUE.withAlpha(0.5);
        viewer.entities.add(polygonEntity);
    }

//Sandcastle_End
    Sandcastle.finishedLoading();
}
if (typeof Cesium !== "undefined") {
    startup(Cesium);
} else if (typeof require === "function") {
    require(["Cesium"], startup);
}