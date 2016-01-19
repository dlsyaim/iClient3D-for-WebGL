/**
 * Created by bcj on 2016/1/12.
 */
define([
    '../Scene/Polygon',
    '../Core/ScreenSpaceEventHandler',
    '../Core/defined',
    '../Core/DeveloperError',
    '../Core/ScreenSpaceEventType',
    '../Scene/Material',
    '../Core/Color',
    '../Scene/Polyline',
    '../Scene/PolylineCollection',
    '../Core/Event'
],function(Polygon,ScreenSpaceEventHandler,defined,DeveloperError,ScreenSpaceEventType,Material,Color,Polyline,PolylineCollection,Event){
    'use strict';
    /**
     * 绘制多边形handler
     * @param {Scene} scene 场景对象
     * @constructor
     * @example
     *   var handler = new Cesium.PolygonHandler(scene);
     *   if(!handler.active){
     *      handler.activate();
     *   }
     *   else{
     *      handler.deactivate();
     *   }
     */
    var PolygonHandler = function(scene){
        if(!defined(scene)){
            throw new DeveloperError('scene is required!');
        }
        this.handler = new ScreenSpaceEventHandler(scene.canvas);
        this.scene = scene;
        this.isDrawing = false;
        this.currentDrawingPolygon = undefined;
        this.active = false;
        this.tmpPolyline = undefined;
        this.tmpPolylineCollection = new PolylineCollection();
        scene.primitives.add(this.tmpPolylineCollection);
        this.drawCompletedEvent = new Event();
    };
    /**
     * 激活handler
     */
    PolygonHandler.prototype.activate = function(){
        this.active = true;
        var that = this;
        this.handler.setInputAction(function(evt){
            clickHandler(evt,that);
        },ScreenSpaceEventType.LEFT_CLICK);
        this.handler.setInputAction(function(movement){
            moveHandler(movement,that);
        },ScreenSpaceEventType.MOUSE_MOVE);
        this.handler.setInputAction(function(evt){
            dbclickHandler(evt,that);
        },ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
    };
    /**
     * 使handler失去激活状态
     */
    PolygonHandler.prototype.deactivate = function(){
        this.active = false;
        this.isDrawing = false;
        this.currentPolyline = undefined;
        this.handler.removeInputAction(ScreenSpaceEventType.LEFT_CLICK);
        this.handler.removeInputAction(ScreenSpaceEventType.MOUSE_MOVE);
        this.handler.removeInputAction(ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
    };
    /**
     * 鼠标左键单击事件处理函数
     * @param evt 浏览器事件
     * @param {PolygonHandler} polygonHandler PolygonHandler对象
     */
    function clickHandler(evt,polygonHandler){
        var that = polygonHandler;
        if(that && that.active){
            var scene = that.scene;
            var camera = scene.camera;
            var ellipsoid = scene.globe.ellipsoid;
            var cartesian = camera.pickEllipsoid(evt.position, ellipsoid);
            if(cartesian){
                if(!that.isDrawing){
                    that.isDrawing = true;
                    var polygon = new Polygon({
                        asynchronous : false
                    });
                    polygon.material.uniforms.color = Color.BLUE.withAlpha(0.5);
                    polygon.positions = [cartesian,cartesian,cartesian];
                    that.currentDrawingPolygon = scene.primitives.add(polygon);
                    that.tmpPolyline = that.tmpPolylineCollection.add({
                        show : true,
                        positions : [cartesian,cartesian],
                        width : 2,
                        material : Material.fromType(Material.ColorType, {
                            color : new Color(0, 0, 1.0, 1.0)
                        })
                    });
                }
                else{
                    var positions = that.currentDrawingPolygon.positions;
                    positions.push(cartesian);
                    that.currentDrawingPolygon.positions = positions;
                }
            }
        }
    }

    /**
     * 鼠标移动事件处理函数
     * @param movement 浏览器事件
     * @param {PolygonHandler} polygonHandler {PolygonHandler}对象
     */
    function moveHandler(movement,polygonHandler){
        var that = polygonHandler;
        if(that && that.active && that.isDrawing){
            var scene = that.scene;
            var camera = scene.camera;
            var ellipsoid = scene.globe.ellipsoid;
            var cartesian = camera.pickEllipsoid(movement.endPosition, ellipsoid);
            if (cartesian) {
                var positions = that.currentDrawingPolygon.positions;
                var len = positions.length;
                positions[len - 1] = cartesian;
                if(len >= 4){
                    if(defined(that.tmpPolyline)){
                        that.tmpPolylineCollection.removeAll();
                        that.tmpPolyline._destroy();
                        that.tmpPolyline = undefined;
                    }
                    that.currentDrawingPolygon.positions = positions;
                }
                else{
                    that.tmpPolyline.positions = positions;
                }

            }
        }
    }

    /**
     * 鼠标左键双击事件处理函数，结束绘制，使handler处于非激活状态
     * @param evt
     * @param polygonHandler
     */
    function dbclickHandler(evt,polygonHandler){
        var event = polygonHandler.drawCompletedEvent;
        var polygon = polygonHandler.currentDrawingPolygon;
        event.raiseEvent(polygon);
        polygonHandler.deactivate();
    }
    return PolygonHandler;
});