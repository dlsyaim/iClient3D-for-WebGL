/**
 * Created by bcj on 2016/1/12.
 */
define([
    '../Scene/PolylineCollection',
    '../Core/ScreenSpaceEventHandler',
    '../Core/defined',
    '../Core/DeveloperError',
    '../Core/ScreenSpaceEventType',
    '../Scene/Material',
    '../Core/Color',
    '../Core/Event'
],function(PolylineCollection,ScreenSpaceEventHandler,defined,DeveloperError,ScreenSpaceEventType,Material,Color,Event){
    'use strict';
    /**
     * 绘制折线handler
     * @param {Scene} scene 场景对象
     * @constructor
     * @example
     * var handler = new PolylineHandler(scene);
     * if(!handler.active){
     *     handler.activate();
     * }
     * else{
     *     handler.deactivate();
     * }
     */
    var PolylineHandler = function(scene){
        if(!defined(scene)){
            throw new DeveloperError('scene is required!');
        }
        this.handler = new ScreenSpaceEventHandler(scene.canvas);
        this.scene = scene;
        this.isDrawing = false;
        this.polylines = new PolylineCollection();
        scene.primitives.add(this.polylines);
        this.currentDrawingPolyline = undefined;
        this.active = false;
        this.drawCompletedEvent = new Event();
    };
    /**
     * 激活handler
     */
    PolylineHandler.prototype.activate = function(){
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
     * 使handler处于非激活状态
     */
    PolylineHandler.prototype.deactivate = function(){
        this.active = false;
        this.isDrawing = false;
        this.currentDrawingPolyline = undefined;
        this.handler.removeInputAction(ScreenSpaceEventType.LEFT_CLICK);
        this.handler.removeInputAction(ScreenSpaceEventType.MOUSE_MOVE);
        this.handler.removeInputAction(ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
    };
    /**
     * 鼠标左键单击事件处理函数
     * @param evt
     * @param polylineHandler PolylineHandler对象
     */
    function clickHandler(evt,polylineHandler){
        var that = polylineHandler;
        if(that && that.active){
            var scene = that.scene;
            var camera = scene.camera;
            var ellipsoid = scene.globe.ellipsoid;
            var cartesian = camera.pickEllipsoid(evt.position, ellipsoid);
            if(cartesian){
                if(!that.isDrawing){
                    that.isDrawing = true;
                    that.currentDrawingPolyline = that.polylines.add({
                        show : true,
                        width : 2,
                        positions : [cartesian,cartesian],
                        material : Material.fromType(Material.ColorType, {
                            color : new Color(1.0, 0, 0, 1.0)
                        })
                    });
                }
                else{
                    var positions = that.currentDrawingPolyline.positions;
                    positions.push(cartesian);
                    that.currentDrawingPolyline.positions = positions;
                }
            }
        }
    }

    /**
     * 鼠标移动事件处理函数
     * @param movement
     * @param polylineHandler PolylineHandler对象
     */
    function moveHandler(movement,polylineHandler){
        var that = polylineHandler;
        if(that && that.active && that.isDrawing){
            var scene = that.scene;
            var camera = scene.camera;
            var ellipsoid = scene.globe.ellipsoid;
            var cartesian = camera.pickEllipsoid(movement.endPosition, ellipsoid);
            if (cartesian) {
                var positions = that.currentDrawingPolyline.positions;
                var len = positions.length;
                positions[len - 1] = cartesian;
                that.currentDrawingPolyline.positions = positions;
            }
        }
    }

    /**
     * 鼠标左键双击事件处理函数，结束绘制，并使handler处于非激活状态
     * @param evt
     * @param polylineHandler PolylineHandler对象
     */
    function dbclickHandler(evt,polylineHandler){
        var event = polylineHandler.drawCompletedEvent;
        var polyline = polylineHandler.currentDrawingPolyline;
        event.raiseEvent(polyline);
        polylineHandler.deactivate();
    }
    return PolylineHandler;
});