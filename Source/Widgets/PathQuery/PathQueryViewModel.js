/*global define*/
define([
    '../../Core/Cartesian3',
    '../../Core/defined',
    '../../Core/defineProperties',
    '../../Core/DeveloperError',
    '../../Core/jsonp',
    '../../Core/Matrix4',
    '../../ThirdParty/knockout',
    '../../ThirdParty/when',
    '../createCommand',
    '../../Core/loadJson',
    '../../Core/Color'
], function(
    Cartesian3,
    defined,
    defineProperties,
    DeveloperError,
    jsonp,
    Matrix4,
    knockout,
    when,
    createCommand,
    loadJson,
    Color) {
    "use strict";

    var notQuery = true;//不是真正的查询，不想服务器发送查询请求（因为value更新的时候会执行查询函数，我们从查询结果中选择的时候那次更新input的value值不需要走查询，以此来控制是否是需要向服务器发请求）
    var isSearching = false;//判断是否正在查询过程中，如果是，则放弃本次查询，待上次查询结果返回
    /**
     * The view model for the {@link PathQuery} widget.
     * @alias PathQueryViewModel
     * @constructor
     *
     * @param {Viewer} viewer instance
     */
    var PathQueryViewModel = function(viewer) {
        //>>includeStart('debug', pragmas.debug);
        if (!defined(viewer)) {
            throw new DeveloperError('viewer is required.');
        }
        //>>includeEnd('debug');

        this._viewer = viewer;
        this._pathEntity = undefined;
        this._startLocation = '';
        this._startLocationLonLat = undefined;
        this._startLocationSet = [];
        this._endLocation = '';
        this._endLocationLonLat = undefined;
        this._endLocationSet = [];
        this._dropDownPanelVisible = false;
        var that = this;
        /**
         * 在起始位置的选项集中选中一项
         */
        this._startLocationSelHandler = createCommand(function(obj){
            that.startLocationSet.removeAll();
            notQuery = true;
            that.startLocation = obj.name;
            that.startLocationLonLat = obj.location;
        });
        /**
         * 在终点位置的结果集中选中一项
         */
        this._endLocationSelHandler = createCommand(function(obj){
            that.endLocationSet.removeAll();
            notQuery = true;
            that.endLocation = obj.name;
            that.endLocationLonLat = obj.location;
        });
        /**
         * 查询路径
         */
        this._queryPathHandler = createCommand(function(){
            if(/^\s*$/.test(that.startLocation) || /^\s*$/.test(that.endLocation)){
                alert("起始位置或者终止位置不能为空！！");
                return ;
            }
            if(isSearching){
                return;
            }
            var startObj = that.startLocationLonLat;
            var endObj = that.endLocationLonLat;
            var promise = queryPath(startObj,endObj);
            if(defined(promise)){
                var polylinePoints = [];
                when(promise,function(dataSet){
                    isSearching = false;
                    var data = dataSet[0];
                    if(data !== undefined){
                        var pathPosints = data.pathPoints;
                        for(var i = 0,j = pathPosints.length;i < j;i++){
                            var obj = GPS.gcj_decrypt_exact(pathPosints[i].y,pathPosints[i].x);
                            var x = obj.lon;
                            var y = obj.lat;
                            polylinePoints.push(x);
                            polylinePoints.push(y);
                        }
                        if(defined(that.pathEntity)){
                            that.viewer.entities.remove(that.pathEntity);
                        }
                        that.pathEntity = that.viewer.entities.add({
                            name : 'Red line on the surface',
                            polyline : {
                                positions : Cartesian3.fromDegreesArray(polylinePoints),
                                width : 5,
                                material : Color.RED
                            }
                        });
                        var gpsLonLat = GPS.gcj_decrypt_exact(that.startLocationLonLat.y,that.startLocationLonLat.x);
                        updateCamera(that.viewer.scene,Cartesian3.fromDegrees(gpsLonLat.lon,gpsLonLat.lat,500));
                    }
                });
            }
        });
        /**
         * 显示、隐藏查询面板
         */
        this._toggleDropDownPanel = createCommand(function(){
            that.dropDownPanelVisible = !that.dropDownPanelVisible;
        });
        knockout.track(this);
        /**
         * 双向绑定startLocation（起始位置），这个值是observable的
         */
        knockout.defineProperty(this,'startLocation',{
            get : function(){
                return this._startLocation;
            },
            set : function(value){
                this._startLocation = value;
            }
        });
        /**
         * 双向绑定startLocationLonLat（起始位置经纬度值），这个值是observable的
         */
        knockout.defineProperty(this,'startLocationLonLat',{
            get : function(){
                return this._startLocationLonLat;
            },
            set : function(value){
                this._startLocationLonLat = value;
            }
        });
        /**
         * 双向绑定startLocationSet（起始位置集合）,并且是observable的
         */
        knockout.defineProperty(this,'startLocationSet',{
            get : function(){
                return this._startLocationSet;
            },
            set : function(value){
                this._startLocationSet = value;
            }
        });
        /**
         * 双向绑定endLocation（终点位置），并且这个值是observable的
         */
        knockout.defineProperty(this,'endLocation',{
            get : function(){
                return this._endLocation;
            },
            set : function(value){
                this._endLocation = value;
            }
        });
        /**
         * 双向绑定endLocationLonLat（终点位置经纬度），并且这个值是observable的
         */
        knockout.defineProperty(this,'endLocationLonLat',{
            get : function(){
                return this._endLocationLonLat;
            },
            set : function(value){
                this._endLocationLonLat = value;
            }
        });
        /**
         * 双向绑定endLocationSet（终点位置集合），并且这个值是observable的
         */
        knockout.defineProperty(this,'endLocationSet',{
            get : function(){
                return this._endLocationSet;
            },
            set : function(value){
                this._endLocationSet = value;
            }
        });
        /**
         * 双向绑定dropDownPanelVisible（查询面板可见性），并且这个值是observable的
         */
        knockout.defineProperty(this,'dropDownPanelVisible',{
            get : function(){
                return this._dropDownPanelVisible;
            },
            set : function(value){
                this._dropDownPanelVisible = value;
            }
        });
        /**
         * 绑定toggleDropDownPanel（toggle查询面板可见性按钮command），并且这个值是observable的
         */
        knockout.defineProperty(this,'toggleDropDownPanel',{
            get : function(){
                return this._toggleDropDownPanel;
            }
        });
        /**
         * 绑定queryPathHandler（查询路径command），并且这个值是observable的
         */
        knockout.defineProperty(this,'queryPathHandler',{
            get : function(){
                return this._queryPathHandler;
            }
        });
        /**
         * 绑定startLocationSelHandler（在起始位置结果集中选中一项的回调command），并且这个值是observable的
         */
        knockout.defineProperty(this,'startLocationSelHandler',{
            get : function(){
                return this._startLocationSelHandler;
            }
        });
        /**
         * 绑定endLocationSelHandler（在终点位置结果集中选中一项的回调command），并且这个值是observable的
         */
        knockout.defineProperty(this,'endLocationSelHandler',{
            get : function(){
                return this._endLocationSelHandler;
            }
        });
        /**
         * 显示订阅startLocation，即在起始位置input的值更新时通知订阅者调用回调函数（查询）
         */
        knockout.getObservable(this, 'startLocation').subscribe(function(newValue) {
            if (/^\s*$/.test(newValue)) {
                that.startLocationSet.removeAll();
                return;
            }
            if(notQuery){
                notQuery = false;
                return;
            }
            if(isSearching){
                return;
            }
            var promise = queryLocation(newValue);
            if(defined(promise)){
                when(promise,function(result){
                    isSearching = false;
                    that.startLocationSet.removeAll();
                    for(var i = 0,j = result.poiInfos.length;i < j;i++){
                        var obj = {};
                        obj.location = result.poiInfos[i].location;
                        obj.name = result.poiInfos[i].name;
                        that.startLocationSet.push(obj);
                    }
                });
            }
        });
        /**
         * 显示订阅endLocation，即在终点位置input的值更新时会通知订阅者调用回调函数
         */
        knockout.getObservable(this, 'endLocation').subscribe(function(newValue) {
            if (/^\s*$/.test(newValue)) {
                that.endLocationSet.removeAll();
                return;
            }
            if(notQuery){
                notQuery = false;
                return;
            }
            if(isSearching){
                return;
            }
            var promise = queryLocation(newValue);
            if(defined(promise)){
                when(promise,function(result){
                    isSearching = false;
                    that.endLocationSet.removeAll();
                    for(var i = 0,j = result.poiInfos.length;i < j;i++){
                        var obj = {};
                        obj.location = result.poiInfos[i].location;
                        obj.name = result.poiInfos[i].name;
                        that.endLocationSet.push(obj);
                    }
                });
            }
        });
    };

    defineProperties(PathQueryViewModel.prototype, {
        viewer : {
            get : function(){
                return this._viewer;
            }
        },
        pathEntity : {
            get : function(){
                return this._pathEntity;
            },
            set : function(value){
                this._pathEntity = value;
            }
        }
    });
    var queryLocationUrl = 'http://www.supermapol.com/iserver/services/localsearch/rest/searchdatas/China/poiinfos.jsonp';

    /**
     * 查询位置
     * @param queryKeyWords 位置查询关键字
     * @returns {Promise}
     */
    function queryLocation(queryKeyWords){
        isSearching = true;
        var promise = jsonp(queryLocationUrl, {
            parameters : {
                keywords : queryKeyWords,
                city : "\u5317\u4eac\u5e02",
                location : '',
                radius : '',
                leftLocation : '',
                rightLocation : '',
                pageSize : 50,
                pageNum : 1
            },
            callbackParameterName : 'callback',
            jsonpName : 'callBack'
        });
        return promise;
    }

    var urlTemplate = "http://www.supermapol.com/iserver/services/navigation/rest/navigationanalyst/China/pathanalystresults.rjson?pathAnalystParameters=" +
        "[{startPoint:{'x':{sx},'y':{sy}},endPoint:{'x':{ex},'y':{ey}},passPoints:null,routeType:MINLENGTH}]";

    /**
     * 路径查询
     * @param startLocation {Object}  起始位置,如{x:1,y:2}
     * @param endLocation {Object} 终点位置,如{x:2,y:3}
     * @returns {Promise}
     */
    function queryPath(startLocation,endLocation){
        var url = urlTemplate.replace('{sx}',startLocation.x).replace('{sy}',startLocation.y).replace('{ex}',endLocation.x).replace('{ey}',endLocation.y);
        var promise  = loadJson(url);
        isSearching = true;
        return promise;
    }

    /**
     * 如果查询成功，相机飞行到起始位置
     * @param scene
     * @param position
     */
    function updateCamera(scene, position) {
        if(!defined(scene) || !defined(position)){
            return;
        }
        scene.camera.flyTo({
            destination : position,
            duration : 5,
            endTransform : Matrix4.IDENTITY,
            convert : false
        });
    }

    /**
     * 纠偏算法
     * @type {{PI: number, x_pi: number, delta: delta, gcj_encrypt: gcj_encrypt, gcj_decrypt: gcj_decrypt, gcj_decrypt_exact: gcj_decrypt_exact, bd_encrypt: bd_encrypt, bd_decrypt: bd_decrypt, mercator_encrypt: mercator_encrypt, mercator_decrypt: mercator_decrypt, distance: distance, outOfChina: outOfChina, transformLat: transformLat, transformLon: transformLon}}
     */
    var GPS = {
        PI : 3.14159265358979324,
        x_pi : 3.14159265358979324 * 3000.0 / 180.0,
        delta : function (lat, lon) {
            // Krasovsky 1940
            //
            // a = 6378245.0, 1/f = 298.3
            // b = a * (1 - f)
            // ee = (a^2 - b^2) / a^2;
            var a = 6378245.0; //  a: 卫星椭球坐标投影到平面地图坐标系的投影因子。
            var ee = 0.00669342162296594323; //  ee: 椭球的偏心率。
            var dLat = this.transformLat(lon - 105.0, lat - 35.0);
            var dLon = this.transformLon(lon - 105.0, lat - 35.0);
            var radLat = lat / 180.0 * this.PI;
            var magic = Math.sin(radLat);
            magic = 1 - ee * magic * magic;
            var sqrtMagic = Math.sqrt(magic);
            dLat = (dLat * 180.0) / ((a * (1 - ee)) / (magic * sqrtMagic) * this.PI);
            dLon = (dLon * 180.0) / (a / sqrtMagic * Math.cos(radLat) * this.PI);
            return {'lat': dLat, 'lon': dLon};
        },

        //WGS-84 to GCJ-02
        gcj_encrypt : function (wgsLat, wgsLon) {
            if (this.outOfChina(wgsLat, wgsLon))
                return {'lat': wgsLat, 'lon': wgsLon};

            var d = this.delta(wgsLat, wgsLon);
            return {'lat' : wgsLat + d.lat,'lon' : wgsLon + d.lon};
        },
        //GCJ-02 to WGS-84
        gcj_decrypt : function (gcjLat, gcjLon) {
            if (this.outOfChina(gcjLat, gcjLon))
                return {'lat': gcjLat, 'lon': gcjLon};

            var d = this.delta(gcjLat, gcjLon);
            return {'lat': gcjLat - d.lat, 'lon': gcjLon - d.lon};
        },
        //GCJ-02 to WGS-84 exactly
        gcj_decrypt_exact : function (gcjLat, gcjLon) {
            var initDelta = 0.01;
            var threshold = 0.000000001;
            var dLat = initDelta, dLon = initDelta;
            var mLat = gcjLat - dLat, mLon = gcjLon - dLon;
            var pLat = gcjLat + dLat, pLon = gcjLon + dLon;
            var wgsLat, wgsLon, i = 0;
            while (1) {
                wgsLat = (mLat + pLat) / 2;
                wgsLon = (mLon + pLon) / 2;
                var tmp = this.gcj_encrypt(wgsLat, wgsLon)
                dLat = tmp.lat - gcjLat;
                dLon = tmp.lon - gcjLon;
                if ((Math.abs(dLat) < threshold) && (Math.abs(dLon) < threshold))
                    break;

                if (dLat > 0) pLat = wgsLat; else mLat = wgsLat;
                if (dLon > 0) pLon = wgsLon; else mLon = wgsLon;

                if (++i > 10000) break;
            }
            //console.log(i);
            return {'lat': wgsLat, 'lon': wgsLon};
        },
        //GCJ-02 to BD-09
        bd_encrypt : function (gcjLat, gcjLon) {
            var x = gcjLon, y = gcjLat;
            var z = Math.sqrt(x * x + y * y) + 0.00002 * Math.sin(y * this.x_pi);
            var theta = Math.atan2(y, x) + 0.000003 * Math.cos(x * this.x_pi);
            var bdLon = z * Math.cos(theta) + 0.0065;
            var bdLat = z * Math.sin(theta) + 0.006;
            return {'lat' : bdLat,'lon' : bdLon};
        },
        //BD-09 to GCJ-02
        bd_decrypt : function (bdLat, bdLon) {
            var x = bdLon - 0.0065, y = bdLat - 0.006;
            var z = Math.sqrt(x * x + y * y) - 0.00002 * Math.sin(y * this.x_pi);
            var theta = Math.atan2(y, x) - 0.000003 * Math.cos(x * this.x_pi);
            var gcjLon = z * Math.cos(theta);
            var gcjLat = z * Math.sin(theta);
            return {'lat' : gcjLat, 'lon' : gcjLon};
        },
        //WGS-84 to Web mercator
        //mercatorLat -> y mercatorLon -> x
        mercator_encrypt : function(wgsLat, wgsLon) {
            var x = wgsLon * 20037508.34 / 180.;
            var y = Math.log(Math.tan((90. + wgsLat) * this.PI / 360.)) / (this.PI / 180.);
            y = y * 20037508.34 / 180.;
            return {'lat' : y, 'lon' : x};
            /*
             if ((Math.abs(wgsLon) > 180 || Math.abs(wgsLat) > 90))
             return null;
             var x = 6378137.0 * wgsLon * 0.017453292519943295;
             var a = wgsLat * 0.017453292519943295;
             var y = 3189068.5 * Math.log((1.0 + Math.sin(a)) / (1.0 - Math.sin(a)));
             return {'lat' : y, 'lon' : x};
             //*/
        },
        // Web mercator to WGS-84
        // mercatorLat -> y mercatorLon -> x
        mercator_decrypt : function(mercatorLat, mercatorLon) {
            var x = mercatorLon / 20037508.34 * 180.;
            var y = mercatorLat / 20037508.34 * 180.;
            y = 180 / this.PI * (2 * Math.atan(Math.exp(y * this.PI / 180.)) - this.PI / 2);
            return {'lat' : y, 'lon' : x};
            /*
             if (Math.abs(mercatorLon) < 180 && Math.abs(mercatorLat) < 90)
             return null;
             if ((Math.abs(mercatorLon) > 20037508.3427892) || (Math.abs(mercatorLat) > 20037508.3427892))
             return null;
             var a = mercatorLon / 6378137.0 * 57.295779513082323;
             var x = a - (Math.floor(((a + 180.0) / 360.0)) * 360.0);
             var y = (1.5707963267948966 - (2.0 * Math.atan(Math.exp((-1.0 * mercatorLat) / 6378137.0)))) * 57.295779513082323;
             return {'lat' : y, 'lon' : x};
             //*/
        },
        // two point's distance
        distance : function (latA, lonA, latB, lonB) {
            var earthR = 6371000.;
            var x = Math.cos(latA * this.PI / 180.) * Math.cos(latB * this.PI / 180.) * Math.cos((lonA - lonB) * this.PI / 180);
            var y = Math.sin(latA * this.PI / 180.) * Math.sin(latB * this.PI / 180.);
            var s = x + y;
            if (s > 1) s = 1;
            if (s < -1) s = -1;
            var alpha = Math.acos(s);
            var distance = alpha * earthR;
            return distance;
        },
        outOfChina : function (lat, lon) {
            if (lon < 72.004 || lon > 137.8347)
                return true;
            if (lat < 0.8293 || lat > 55.8271)
                return true;
            return false;
        },
        transformLat : function (x, y) {
            var ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
            ret += (20.0 * Math.sin(6.0 * x * this.PI) + 20.0 * Math.sin(2.0 * x * this.PI)) * 2.0 / 3.0;
            ret += (20.0 * Math.sin(y * this.PI) + 40.0 * Math.sin(y / 3.0 * this.PI)) * 2.0 / 3.0;
            ret += (160.0 * Math.sin(y / 12.0 * this.PI) + 320 * Math.sin(y * this.PI / 30.0)) * 2.0 / 3.0;
            return ret;
        },
        transformLon : function (x, y) {
            var ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
            ret += (20.0 * Math.sin(6.0 * x * this.PI) + 20.0 * Math.sin(2.0 * x * this.PI)) * 2.0 / 3.0;
            ret += (20.0 * Math.sin(x * this.PI) + 40.0 * Math.sin(x / 3.0 * this.PI)) * 2.0 / 3.0;
            ret += (150.0 * Math.sin(x / 12.0 * this.PI) + 300.0 * Math.sin(x / 30.0 * this.PI)) * 2.0 / 3.0;
            return ret;
        }
    };

    return PathQueryViewModel;
});
