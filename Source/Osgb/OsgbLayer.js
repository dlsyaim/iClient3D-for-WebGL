/**
 * Created by bcj on 2015/9/28.
 */
define([
    '../Core/defined',
    '../Core/BoundingSphere',
    '../Core/Cartesian3',
    './DDSTexture',
    '../Core/Matrix4',
    '../Core/Math',
    '../Core/Matrix3',
    '../Core/Quaternion',
    '../Core/Cartesian4',
    '../Core/Transforms',
    '../Renderer/RenderState',
    '../Scene/DepthFunction',
    '../ThirdParty/when',
    '../Renderer/DrawCommand',
    '../Scene/Pass',
    '../Core/loadXML',
    '../Core/loadArrayBuffer',
    '../Core/throttleRequestByServer',
    '../Core/Intersect',
    '../ThirdParty/Uri',
    '../Core/defineProperties',
    '../Core/Queue',
    '../Core/DeveloperError',
    '../Core/Cartographic' ,
    '../Core/TaskProcessor'
    ],function(defined,BoundingSphere,Cartesian3,DDSTexture,Matrix4,CesiumMath,Matrix3,Quaternion,Cartesian4,Transforms,RenderState,DepthFunction,when,DrawCommand,Pass,loadXML,loadArrayBuffer,throttleRequestByServer,Intersect,Uri,defineProperties,Queue,DeveloperError,Cartographic,TaskProcessor){
        "use strict";
    var RESOLUTION = {
        LOW : 0,
        HIGH : 1
    };
    /**
     * @private
     * 根据半径和距离相机的距离计算boundingSphere的像素大小，作为lod判断标准
     * @param radius boundingSphere的半径
     * @param dDistance boundingSphere 距离相机的距离
     * @param gl webgl context
     * @returns {number} 像素大小（lod判断标准）
     */
    function computerLength2Pix(radius,dDistance,gl,resolution){
        var dFov = 45;
        var height = gl.drawingBufferHeight;
        var theta = CesiumMath.toRadians(dFov) * 0.5;
        var screenYPix = height * 0.5;
        var lamat = screenYPix / Math.tan(theta);
        if(resolution === RESOLUTION.HIGH){
            return Math.ceil(lamat * radius / dDistance) * 2;
        }
        return Math.ceil(lamat * radius / dDistance) * 0.2;
    }

    /**
     * @private
     * 异步下载xml根节点
     * @param xmlUrl xml文件地址
     * @returns {Promise}
     */
    function loadRootXml(xmlUrl){
        var xmlLoader = function(xmlUrl){
            return loadXML(xmlUrl);
        };
        var promise = throttleRequestByServer(xmlUrl, xmlLoader);
        return promise;
    };
    /**
     * @private
     * 异步下载s3m文件
     * @param s3mUrl s3m文件地址
     * @returns {Promise}
     */
    function loadS3m(s3mUrl){
        var s3mLoader = function(s3mUrl){
            return loadArrayBuffer(s3mUrl);
        };
        var promise = throttleRequestByServer(s3mUrl, s3mLoader);
        return promise;
    };
    /**
     * @private
     * 释放资源
     * @param deleteQueue 实体队列
     * @param cacheEntityCount 缓存个数
     */
    function releaseResource(deleteQueue,cacheCount){
        var destroy = function(pageLod){
            if(pageLod && pageLod._renderEntity){
                pageLod._renderEntity.destroy();
                pageLod._renderEntity = null;
            }
        };
        deleteQueue.sort(function(apageLod,bpageLod){
            return apageLod._entity._avgPix - bpageLod._entity._avgPix;
        });
        var deletePagelod,deleteEntity;
        while(deleteQueue.length > cacheCount && (deletePagelod = deleteQueue.dequeue()) ) {
            deleteEntity = deletePagelod._entity;
            deleteEntity.traverse(destroy);
            deleteEntity._s3mLoadState = LOADSTATE.UNLOAD;
            deletePagelod._entity = null;
        }
    };
    /**
     * @private
     * 异步下载状态 未下载、下载中、下载完成
     * @type {{UNLOAD: number, LOADING: number, LOADED: number}}
     */
    var LOADSTATE = {
        UNLOAD : 0,
        LOADING : 1,
        LOADED : 2
    };

    /**
     * @private
     * @constructor
     */
    function Entity(){
        this._fileName = undefined;
        this._filePath = undefined;
        this._childrenPageLod = [];
        this._isLastNode = false;
        this._isRootNode = false;
        this._xmlLoadState = LOADSTATE.UNLOAD;
        this._s3mLoadState = LOADSTATE.UNLOAD;
        this._doc = undefined;
        this._avgPix = 0;
        this._ready = false;
    }

    /**
     * @private 遍历实体
     * @param callback 遍历实体树过程中，每个节点的回调函数
     */
    Entity.prototype.traverse = function(callback){
        for(var i = 0,j = this._childrenPageLod.length;i < j;i++){
            var pageLod = this._childrenPageLod[i];
            callback(pageLod);
            if(pageLod._entity){
                pageLod._entity.traverse(callback);
            }
            else{
                return;
            }
        }
    };
    /**
     * @private
     * @constructor
     */
    function PagedLOD(){
        this._boundingSphere = undefined;
        this._rangeList = 0.0;
        this._rangeDataList = undefined;
        this._isLast = false;
        this._isLessLodDis = true;
        this._entity = null;
        this._renderEntity = null;
        this._pix = 0;
    }

    /**
     * @private
     * 计算像素大小根据boundingSphere距离相机的距离
     * @param vCam
     * @param gl
     */
    PagedLOD.prototype.calcPixFromCam = function(vCam,gl,resolution){
        if(!this._boundingSphere){
            return;
        }
        var vec = Cartesian3.clone(this._boundingSphere.center);
        var dis = Cartesian3.distance(vec,vCam);
        var npix = computerLength2Pix(this._boundingSphere.radius ,dis,gl,resolution);
        this._pix = npix;
        if(this._entity){
            this._entity._avgPix = npix;
        }
        this._isLessLodDis = (npix <= this._rangeList);
    };
    /**
     * @private
     * S3M版本 S3M:没有单体化、S3M4：有单体化
     * @type {{S3M: number, S3M4: number}}
     */
    var VERSION = {
        S3M : 52,
        S3M4 : 53
    };

    /**
     * render 实体
     * @param options Object with the following properties:
     * @param {WebGLRenderingContext} options.gl WebGLRenderingContext
     * @param {DDSTexture} options.texture DDSTexture
     * @param {Array} options.indexes
     * @param {Array} options.vertexes
     * @param {Number} options.indexCount
     * @exception {DeveloperError} options and options.gl and options.texture and options.indexes and options.vertexes and options.indexCount are required.
     * @constructor
     */
    function RenderEntityPagedLOD(options){
        options = options || {};
        var indexes = options.indexes;
        var vertexes = options.vertexes;
        if(!options.gl || !options.texture || !options.indexes || !options.vertexes || !options.indexCount){
            throw new DeveloperError('gl texture indexes vertexes indexcount  is required to create RenderEntityPagelod');
        }
        this._gl = options.gl;
        this._indexCount = options.indexCount;
        this._texture = options.texture;
        this._program = null;
        this._ibo = null;
        this._vbo = null;
        this._version = options.version || VERSION.S3M;// n3m4
        this._size = options.size || 5;
        this._drawCommand = null;
        this.initVertexBuffers(indexes,vertexes);
    }

    /**
     * init render Object
     * @param indexes
     * @param vertexes
     */
    RenderEntityPagedLOD.prototype.initVertexBuffers = function(indexes,vertexes){
        var gl = this._gl;
        this._ibo = gl.createBuffer();
        if (!this._ibo)
            return;
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._ibo);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indexes, gl.STATIC_DRAW);
        this._vbo = gl.createBuffer();
        if(!this._vbo){
            return;
        }
        gl.bindBuffer(gl.ARRAY_BUFFER, this._vbo);
        gl.bufferData(gl.ARRAY_BUFFER, vertexes, gl.STATIC_DRAW);
    };
    /**
     * draw vbo
     */
    RenderEntityPagedLOD.prototype.render = function(){
        var gl = this._gl;
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this._ibo);
        gl.bindBuffer(gl.ARRAY_BUFFER, this._vbo);
        gl.enableVertexAttribArray(0);
        gl.enableVertexAttribArray(1);
        if(VERSION.S3M4 == this._version){
            gl.enableVertexAttribArray(2);
        }
        gl.vertexAttribPointer(0, 3, gl.FLOAT, false, this._size * 4, 0 * 4); // position
        gl.vertexAttribPointer(1, 2, gl.FLOAT, false, this._size * 4, 3 * 4); // texcoord
        if(VERSION.S3M4 == this._version){
            gl.vertexAttribPointer(2, 4, gl.FLOAT, false, this._size * 4, 5 * 4); // color
        }
        this._texture.enable();
        gl.drawElements(gl.TRIANGLES, this._indexCount, gl.UNSIGNED_SHORT, 0);
        gl.disableVertexAttribArray(0);
        gl.disableVertexAttribArray(1);
        if(VERSION.S3M4 == this._version){
            gl.disableVertexAttribArray(2);
        }
        this._texture.disable();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
    };
    /**
     * destroy resource
     */
    RenderEntityPagedLOD.prototype.destroy = function(){
        this._texture.destroy();
        this._gl.deleteBuffer(this._ibo);
        this._ibo = null;
        this._gl.deleteBuffer(this._vbo);
        this._vbo = null;
        this._texture = null;
        this._drawCommand = null;
    };
    /**
     * @alias OsgbLayer
     * @param options [options] Object with the following properties:
     * @param {WebGLRenderingContext} options.gl WebGLRenderingContext
     * @param {Array} options.servers an array os server subdomains
     * @param {Array} options.urls xml urls array
     * @param {Array} options.position the [lon,lat,height] or [lon,lat](default height is 0) of the osgblayer's reference point
     * @exception {DeveloperError} options and options.gl and options.servers and options.urls and options.position are required.
     * @example
     * //new OsgbLayer instance
     * var osgbLayer = new OsgbLayer({
     *  gl : gl,
     *  servers : ["http://localhost:8090"],
     *  urls : ["http://localhost:8090/data/tile_001.xml","http://localhost:8090/data/tile_002.xml"],
     *  position : [10,20]
     * });
     *
     *
     * @constructor
     */
    var OsgbLayer = function(options){
        options = options || {};
        var gl = options.gl;
        if(!gl){
            throw new DeveloperError('gl is required to create create osgbLayer');
        }
        var servers = options.servers;
        if(!servers){
            throw new DeveloperError('servers is required to create create osgbLayer');
        }
        var urls = options.urls;
        if(!urls){
            throw new DeveloperError('urls is required to create create osgbLayer');
        }
        var position = options.position;
        if(!position || !(position instanceof  Array) || 2 > position.length){
            throw new DeveloperError('position is required to create create osgbLayer');
        }
        this._gl = gl;

        this._withXML = options.withXML;

        if(this._withXML == false)
        {
            OsgbLayer.prototype.update = OsgbLayer.prototype.updateWithoutXML;

        }
        else
        {
            OsgbLayer.prototype.update = OsgbLayer.prototype.updateWithXML;
        }

        this._servers = [].concat(servers);
        this._urls = [].concat(urls);
        this._renderQueue = [];
        this._rootEntitys = [];
        this._version = undefined;
        this._matModel = new Matrix4();
        this._program = undefined;
        this._cacheEntityCount = options.cacheEntityCount || 10;
        this._pixels = new Uint8Array(4);
        this._renderState = RenderState.fromCache({ // Write color and depth
            cull : {
                enabled : true
            },
            depthTest : {
                enabled : true,
                func : DepthFunction.LESS
            }
        });
        this.lon = position[0];
        this.lat = position[1];
        this.height = 0;
        this._isPc = isPCBroswer();
        if(this._isPc){
            this._resolution = RESOLUTION.HIGH;
        }
        else{
            this._resolution = RESOLUTION.LOW;
            this._cacheEntityCount = 0;
        }
        position = Cartesian3.fromDegrees(this.lon,this.lat,this.height);
        var orientation = Transforms.headingPitchRollQuaternion(position, 0, 0, 0);
        Matrix4.fromRotationTranslation(Matrix3.fromQuaternion(orientation), position, this._matModel);
        for(var i = 0,j = this._urls.length;i < j;i++){
            var uri = new Uri(this._urls[i]);
            var path = uri.getPath();
            var index = path.lastIndexOf('/') + 1;
            var filePath = path.substr(0,index);
            var fileName = path.substr(index);
            fileName = fileName.substr(0,fileName.indexOf('.'));
            var entity = new Entity();
            entity._filePath =  filePath;
            entity._fileName =  fileName;
            entity._isRootNode = true;
            this._rootEntitys.push(entity);
        }
        this.initShader();
    };
    defineProperties(OsgbLayer.prototype, {
        /**
         * Gets or Sets the pixels in render to texture of frambuffer(use picking object)
         * @memberof OsbgLayer.prototype
         * @type {Array}
         */
        pixels : {
            get : function() {
                return this._pixels;
            },
            set : function(value) {
                this._pixels = value;
            }
        }
    });

    var taskProcessor = new TaskProcessor('osgbParser',10000);

    OsgbLayer.prototype.loadEntity = function(entity){
        var _this = this;
        var s3mLoadState = entity._s3mLoadState;
        if(LOADSTATE.UNLOAD == s3mLoadState){
            var server = this._servers[0];
            //var s3mUrl = "http://" + server + '/' + entity._filePath + '/' + entity._fileName + '.s3m';
            var s3mUrl = server + entity._filePath + '/' + entity._fileName + '.s3m';
            var promise = loadS3m(s3mUrl);
            if(promise){
                promise.then(function(buffer){

                    binaryDataParser(_this,entity,buffer,RenderEntityPagedLOD);

                },function(error){
                    entity._s3mLoadState = LOADSTATE.UNLOAD;
                });
                entity._s3mLoadState = LOADSTATE.LOADING;
            }
        }
    };


    OsgbLayer.prototype.loadRootEntity = function(rootEntity){
        var _this = this;
        var s3mLoadState = rootEntity._s3mLoadState;
        if(LOADSTATE.UNLOAD == s3mLoadState){
            var server = this._servers[0];
            var s3mUrl = server + rootEntity._filePath + rootEntity._fileName + '.s3m';
            var promise = loadS3m(s3mUrl);
            if(promise){
                promise.then(function(buffer){
                    binaryDataParser(_this,rootEntity,buffer,RenderEntityPagedLOD);
                });
                rootEntity._s3mLoadState = LOADSTATE.LOADING;
                rootEntity._xmlLoadState = LOADSTATE.LOADING;
            }
        }
    };

    OsgbLayer.prototype.loadRootEntityAndXML = function(rootEntity){
        var _this = this;
        var xmlLoadState = rootEntity._xmlLoadState;
        if(LOADSTATE.UNLOAD == xmlLoadState){
            var server = this._servers[0];
            var xmlUrl = server + rootEntity._filePath + rootEntity._fileName + '.xml';
            var promise = loadRootXml(xmlUrl);
            if(promise){
                promise.then(function(doc){
                    rootEntity._doc = doc;
                    var group = doc.getElementsByTagName("Group"+rootEntity._fileName)[0];
                    if(group){
                        groupParser(rootEntity,group,_this);
                        rootEntity._xmlLoadState = LOADSTATE.LOADED;
                    }
                },function(error){
                    rootEntity._xmlLoadState = LOADSTATE.UNLOAD;
                    console.log(error);
                });
                rootEntity._xmlLoadState = LOADSTATE.LOADING;
            }
        }
        else if(LOADSTATE.LOADED == xmlLoadState){
            var s3mLoadState = rootEntity._s3mLoadState;
            if(LOADSTATE.UNLOAD == s3mLoadState){
                var server = this._servers[0];
                var s3mUrl = server + rootEntity._filePath + rootEntity._fileName + '.s3m';
                var promise = loadS3m(s3mUrl);
                if(promise){
                    promise.then(function(buffer){
                        binaryDataParser(_this,rootEntity,buffer,RenderEntityPagedLOD);
                    });
                    rootEntity._s3mLoadState = LOADSTATE.LOADING;
                }
            }
        }
    };
    /**
     * 每一帧更新lod
     * @param vCameraPosition {Cartesian3} 相机位置
     * @param matModelViewProjection {Mat4} 模型视图投影矩阵
     * @param cullingVolume {CullingVolume} 裁剪椎体
     * @param commandList {Array} draw command list
     * @param isPicking {boolean} 是否处于picking模式
     * @param globe {Globe}
     */
    OsgbLayer.prototype.updateWithoutXML = function(vCameraPosition, matModelViewProjection,cullingVolume,commandList,isPicking,globe){
        /*var cartographic = Cartographic.fromDegrees(this.lon,this.lat);
        this.height = globe.getHeight(cartographic) || 0;
        //this.height = 0;
        var position = Cartesian3.fromDegrees(this.lon,this.lat,this.height);
        var orientation = Transforms.headingPitchRollQuaternion(position, 0, 0, 0);
        Matrix4.fromRotationTranslation(Matrix3.fromQuaternion(orientation), position, this._matModel);*/
        var _this = this;
        if(!isPicking){
            var traverseQueue = [];
            var loadQueue = new Queue();
            this._renderQueue.length = 0;
            var deleteQueue = new Queue();
            for(var i = 0,j = this._rootEntitys.length;i < j;i++){
                var rootEntity = this._rootEntitys[i];
                this.loadRootEntity(rootEntity);
                rootEntity._ready && traverseQueue.push(rootEntity);
            }
            var entity;
            while(entity = traverseQueue.pop()){
                for(var i = 0,j = entity._childrenPageLod.length;i < j;i++){
                    var pageLod = entity._childrenPageLod[i];
                    if(entity._isLastNode){
                        pageLod._renderEntity && this._renderQueue.push(pageLod._renderEntity);
                    }
                    else{
                        var intersect = cullingVolume.computeVisibility(pageLod._boundingSphere);
                        if(intersect === Intersect.OUTSIDE){
                            pageLod._renderEntity && this._renderQueue.push(pageLod._renderEntity);
                            if(pageLod._entity){
                                deleteQueue.enqueue(pageLod);
                                //pageLod._entity = null;
                            }
                        }
                        else{
                            pageLod.calcPixFromCam(vCameraPosition,this._gl,this._resolution);
                            if(!pageLod._isLessLodDis){
                                if(pageLod._entity){
                                    var s3mLoadState = pageLod._entity._s3mLoadState;
                                    if(s3mLoadState == LOADSTATE.LOADED){
                                        traverseQueue.push(pageLod._entity);
                                    }
                                    else{
                                        pageLod._renderEntity && this._renderQueue.push(pageLod._renderEntity);
                                        loadQueue.enqueue(pageLod._entity);
                                    }
                                }
                                else{
                                    var newEntity = new Entity();
                                    var fileName = pageLod._rangeDataList;
                                    var filePath = entity._filePath;
                                    //newEntity._doc = entity._doc;
                                    newEntity._filePath = filePath;
                                    newEntity._fileName = fileName;
                                    newEntity._avgPix = pageLod._pix;
                                    newEntity._pageLod = pageLod;
                                    //var group = newEntity._doc.getElementsByTagName("Group" + fileName)[0];
                                    //if(group)
                                    {
                                    //    groupParser(newEntity,group,_this,pageLod);
                                        pageLod._entity = newEntity;
                                        loadQueue.enqueue(newEntity);
                                        pageLod._renderEntity && this._renderQueue.push(pageLod._renderEntity);
                                    }
                                }
                            }
                            else{
                                pageLod._renderEntity && this._renderQueue.push(pageLod._renderEntity);
                                if(pageLod._entity){
                                    deleteQueue.enqueue(pageLod);
                                    //pageLod._entity = null;
                                }
                            }
                        }
                    }
                }
            }
            loadQueue.sort(function(aEntity,bEntity){
                return bEntity._avgPix - aEntity._avgPix;
            });
            var loadEntity;
            while(loadEntity = loadQueue.dequeue()){
                this.loadEntity(loadEntity);
            }
            var cacheCount = this._cacheEntityCount || 0;
            releaseResource(deleteQueue,cacheCount);
        }
        for(var i = 0,j = this._renderQueue.length;i < j;i++){
            commandList.push(this._renderQueue[i]._drawCommand);
        }
    };

    OsgbLayer.prototype.updateWithXML = function(vCameraPosition, matModelViewProjection,cullingVolume,commandList,isPicking,globe){
        /*var cartographic = Cartographic.fromDegrees(this.lon,this.lat);
         this.height = globe.getHeight(cartographic) || 0;
         //this.height = 0;
         var position = Cartesian3.fromDegrees(this.lon,this.lat,this.height);
         var orientation = Transforms.headingPitchRollQuaternion(position, 0, 0, 0);
         Matrix4.fromRotationTranslation(Matrix3.fromQuaternion(orientation), position, this._matModel);*/
        var _this = this;
        if(!isPicking){
            var traverseQueue = [];
            var loadQueue = new Queue();
            this._renderQueue.length = 0;
            var deleteQueue = new Queue();
            for(var i = 0,j = this._rootEntitys.length;i < j;i++){
                var rootEntity = this._rootEntitys[i];
                this.loadRootEntityAndXML(rootEntity);
                rootEntity._ready && traverseQueue.push(rootEntity);
            }
            var entity;
            while(entity = traverseQueue.pop()){
                for(var i = 0,j = entity._childrenPageLod.length;i < j;i++){
                    var pageLod = entity._childrenPageLod[i];
                    if(entity._isLastNode){
                        pageLod._renderEntity && this._renderQueue.push(pageLod._renderEntity);
                    }
                    else{
                        var intersect = cullingVolume.computeVisibility(pageLod._boundingSphere);
                        if(intersect === Intersect.OUTSIDE){
                            pageLod._renderEntity && this._renderQueue.push(pageLod._renderEntity);
                            if(pageLod._entity){
                                deleteQueue.enqueue(pageLod);
                                //pageLod._entity = null;
                            }
                        }
                        else{
                            pageLod.calcPixFromCam(vCameraPosition,this._gl,this._resolution);
                            if(!pageLod._isLessLodDis){
                                if(pageLod._entity){
                                    var s3mLoadState = pageLod._entity._s3mLoadState;
                                    if(s3mLoadState == LOADSTATE.LOADED){
                                        traverseQueue.push(pageLod._entity);
                                    }
                                    else{
                                        pageLod._renderEntity && this._renderQueue.push(pageLod._renderEntity);
                                        loadQueue.enqueue(pageLod._entity);
                                    }
                                }
                                else{
                                    var newEntity = new Entity();
                                    var fileName = pageLod._rangeDataList;
                                    var filePath = entity._filePath;
                                    newEntity._doc = entity._doc;
                                    newEntity._filePath = filePath;
                                    newEntity._fileName = fileName;
                                    newEntity._avgPix = pageLod._pix;

                                    var group = newEntity._doc.getElementsByTagName("Group" + fileName)[0];
                                    if(group){
                                        groupParser(newEntity,group,_this,pageLod);
                                        pageLod._entity = newEntity;
                                        loadQueue.enqueue(newEntity);
                                        pageLod._renderEntity && this._renderQueue.push(pageLod._renderEntity);
                                    }
                                }
                            }
                            else{
                                pageLod._renderEntity && this._renderQueue.push(pageLod._renderEntity);
                                if(pageLod._entity){
                                    deleteQueue.enqueue(pageLod);
                                    //pageLod._entity = null;
                                }
                            }
                        }
                    }
                }
            }
            loadQueue.sort(function(aEntity,bEntity){
                return bEntity._avgPix - aEntity._avgPix;
            });
            var loadEntity;
            while(loadEntity = loadQueue.dequeue()){
                this.loadEntity(loadEntity);
            }
            var cacheCount = this._cacheEntityCount || 0;
            releaseResource(deleteQueue,cacheCount);
        }
        for(var i = 0,j = this._renderQueue.length;i < j;i++){
            commandList.push(this._renderQueue[i]._drawCommand);
        }
    };

    OsgbLayer.prototype.stopRequest = function(){
        return;
        for(var i = 0,j = this.httpPool.length;i < j;i++){
            var http = this.httpPool[i];
            http.abort();
        }
    };
    OsgbLayer.prototype.updateRenderState = function(context,passState){
        var previousRenderState = context._currentRenderState;
        var previousPassState = context._currentPassState;
        context._currentRenderState = this._renderState;
        context._currentPassState = passState;
        RenderState.partialApply(context._gl, previousRenderState, this._renderState, previousPassState, passState, false);
    };
    OsgbLayer.prototype.prepareRender = function(proj,picking,view){
        if(this._renderQueue.length > 0){
            var matModelView = new Matrix4();
            Matrix4.multiply(view,this._matModel,matModelView);
            var arrProj = [];
            Matrix4.pack(proj,arrProj,0);
            var arrModelView = [];
            Matrix4.pack(matModelView,arrModelView,0);
            var gl = this._gl;
            gl.useProgram(this._program);
            gl.uniform1i(this._program.uIsPicking, picking);
            var hasSecondColor = (VERSION.S3M4 == this._version);
            gl.uniform1i(this._program.uHasSecondColor, hasSecondColor);
            gl.uniform1i(this._program.uIsPc, this._isPc);
            gl.uniformMatrix4fv(this._program.matModelView, false,new Float32Array(arrModelView));
            gl.uniformMatrix4fv(this._program.matProj, false,new Float32Array(arrProj));
            gl.uniform4f(this._program.uPixels,this._pixels[0],this._pixels[1],this._pixels[2],this._pixels[3]);
        }
    };
    OsgbLayer.prototype.destroy = function(){
        var destroyCallBack = function(pageLod){
            if(pageLod && pageLod._renderEntity){
                pageLod._renderEntity.destroy();
            }
        };
        for(var i = 0,j = this._rootEntitys.length;i < j;i++){
            var entity = this._rootEntitys[i];
            entity && entity.traverse(destroyCallBack);
        }
    };
    function groupParser(pEntity,group,me,pageInfo){
        var pageLods = group.children;
        if(!pageLods){  //user agent is ie
            pageLods = group.childNodes;
            for(var key in pageLods){
                var pageLod = pageLods[key];
                if('PageLod' == pageLod.tagName){
                    pageLodParserIE(pageLod,me,pEntity,pageInfo);
                }
            }
        }
        else{
            for(var i = 0,j = pageLods.length;i < j;i++){
                var pageLod = pageLods[i];
                pageLodParser(pageLod,me,pEntity,pageInfo);
            }
        }
    }

    function pageLodParser(pageLod,me,pEntity,pageInfo){
        if(pageLod.children.length == 0){
            pEntity._isLastNode = true;//最后一个节点
            pageInfo._isLast = true;
            var pPagedInfo = new PagedLOD();
            pPagedInfo._boundingSphere = undefined;
            pEntity._childrenPageLod.push(pPagedInfo);
        }
        else{
            var rangeDataList = pageLod.children[0].textContent;
            var boundSphere = pageLod.children[1];
            var x = parseFloat(boundSphere.children[0].textContent);
            var y = parseFloat(boundSphere.children[1].textContent);
            var z = parseFloat(boundSphere.children[2].textContent);
            var radius = boundSphere.children[3].textContent;
            var rangeList = parseFloat(pageLod.children[2].textContent);

            if(rangeList <0.0000001 && rangeList >-0.0000001)
                return;
            var pPagedInfo = new PagedLOD();
            pPagedInfo._rangeDataList = rangeDataList;
            pPagedInfo._rangeList = rangeList;
            var vecCenter = new Cartesian4(x,y,z,1);
            pPagedInfo._boundingSphere = new BoundingSphere();
            radius = parseFloat(radius);
            var v4 = new Cartesian4();
            Matrix4.multiplyByVector(me._matModel,vecCenter,v4);
            pPagedInfo._boundingSphere.center = new Cartesian3(v4.x,v4.y,v4.z);
            pPagedInfo._boundingSphere.radius = parseFloat(radius);
            pEntity._childrenPageLod.push(pPagedInfo);
        }
    }

    function pageLodParserIE(pageLod,me,pEntity,pageInfo){
        if(0 == pageLod.childElementCount){//最后一个节点
            pEntity._isLastNode = true;//最后一个节点
            pageInfo._isLast = true;
            var pPagedInfo = new PagedLOD();
            pPagedInfo._boundingSphere = undefined;
            pEntity._childrenPageLod.push(pPagedInfo);
        }
        else{
            var childNodes = pageLod.childNodes;
            var rangeDataList,rangeList,sphere;
            for(var key in childNodes){
                var obj = childNodes[key];
                var name = obj.tagName;
                switch(name){
                    case 'RangeDataList' : rangeDataList = obj.textContent;break;
                    case 'RangeList' : rangeList = parseFloat(obj.textContent);break;
                    case 'BoundingSphere' : sphere = boundingSphereParserIE(obj,me);break;
                    default : break;
                }
            }

            if(rangeList <0.0000001 && rangeList >-0.0000001)
                return;

            var pPagedInfo = new PagedLOD();
            pPagedInfo._rangeDataList = rangeDataList;
            pPagedInfo._rangeList = rangeList;
            pPagedInfo._boundingSphere = sphere;
            pEntity._childrenPageLod.push(pPagedInfo);
        }
    }
    function boundingSphereParserIE(obj,me){
        var x, y, z,radius,radiusInv;
        var childNodes = obj.childNodes;
        for(var key in childNodes){
            var el = childNodes[key];
            var name = el.tagName;
            switch(name){
                case 'x' : x = el.textContent;break;
                case 'y' : y = el.textContent;break;
                case 'z' : z = el.textContent;break;
                case 'radius' : radius = el.textContent;break;
                default  : break;
            }
        }
        if(x && y && z && radius){
            x = parseFloat(x);
            y = parseFloat(y);
            z = parseFloat(z);
            radius = parseFloat(radius);
            //radiusInv = radius * CARTESIAN_SCALE_INV;
            var vecCenter = new Cartesian4(x,y,z,1);
            var v4 = new Cartesian4();
            Matrix4.multiplyByVector(me._matModel,vecCenter,v4);
            var res = new BoundingSphere();
            res.center = new Cartesian3(v4.x,v4.y,v4.z);
            res.radius = radius;
            return res;
        }
        return null;
    }

        function binaryDataParser(osglayer,pEntity,data,RenderEntityPagedLOD)
        {
            var isPc = osglayer._isPc;
            var osgPromise = taskProcessor.scheduleTask({
                dataBuffer : data,
                isPc : isPc
            });

            if (!defined(osgPromise)) {
                // Postponed
                return undefined;
            }

            osgPromise.then(function(result){
                if(result.result)
                {
                    pEntity._s3mLoadState = LOADSTATE.LOADED;
                    pEntity._xmlLoadState = LOADSTATE.LOADED;

                    osglayer._version = result.version;
                    var gl = osglayer._gl;
                    if(!gl){
                        pEntity._s3mLoadState = LOADSTATE.UNLOAD;
                        return;
                    }

                    var nPageCount = result.number;

                    if(osglayer._withXML == false)
                    {
                        if(result.vbo[0].strFileName == "")
                        {
                            pEntity._isLastNode = true;//最后一个节点
                            pEntity._pageLod._isLast = true;
                            var pPagedInfo = new PagedLOD();
                            pPagedInfo._boundingSphere = undefined;
                            pEntity._childrenPageLod.push(pPagedInfo);
                        }
                        else
                        {
                            for(var i = 0;i < nPageCount; i++){
                                var pageLod = result.vbo[i];
                                if(pageLod == null)
                                    continue;

                                var rangeDataList = pageLod.strFileName;

                                var x = pageLod.boundingsphere[0];
                                var y = pageLod.boundingsphere[1];
                                var z = pageLod.boundingsphere[2];
                                var radius = pageLod.boundingsphere[3];
                                var rangeList = pageLod.boundingsphere[4];

                                var pPagedInfo = new PagedLOD();

                                pPagedInfo._rangeDataList = rangeDataList;
                                pPagedInfo._rangeList = rangeList;

                                var vecCenter = new Cartesian4(x,y,z,1);
                                pPagedInfo._boundingSphere = new BoundingSphere();

                                var v4 = new Cartesian4();
                                Matrix4.multiplyByVector(osglayer._matModel,vecCenter,v4);
                                pPagedInfo._boundingSphere.center = new Cartesian3(v4.x,v4.y,v4.z);
                                pPagedInfo._boundingSphere.radius = parseFloat(radius);
                                pEntity._childrenPageLod.push(pPagedInfo);
                            }
                        }
                    }

                    if(pEntity._childrenPageLod.length == nPageCount)
                    {
                        for(var i = 0;i < nPageCount;i++)
                        {
                            var pageLod = pEntity._childrenPageLod[i];

                            var vbo = result.vbo[i];
                            var nIndexCount = vbo.indexCount;
                            if(nIndexCount == 0){
                                console.log('nindexcount == 0');
                                pageLod._rangeList = Infinity;//表示这块区域下面没有数据了，是一块无效区域,无需再继续往下遍历
                                continue;
                            }

                            var indexes = vbo.indexData;
                            var vertexes = vbo.vertexData;

                            var width = vbo.nWidth;
                            var height = vbo.nHeight;
                            var pImageBuffer = vbo.imageData;
                            var texture = new DDSTexture(gl,width, height, pImageBuffer,isPc);

                            var renderEntity = new RenderEntityPagedLOD({
                                gl : gl,
                                texture : texture,
                                indexes : indexes,
                                vertexes : vertexes,
                                indexCount : nIndexCount,
                                version : result.version,
                                size : result.version == 53 ? 9 : 5
                            });
                            renderEntity._drawCommand = new DrawCommand({
                                boundingVolume : pageLod._boundingSphere,
                                pass : Pass.OSGB,
                                owner : renderEntity
                            });
                            pageLod._renderEntity = renderEntity;
                        }

                        pEntity._ready = true;
                    }

                }
                else
                {
                    pEntity._s3mLoadState = LOADSTATE.UNLOAD;
                }
            });
//            when(osgPromise, function(result) {
//
//
//
//            });

//            var header = new Uint8Array(data);
//            if (header[0] != 115 || header[1] != 51 || header[2] != 109) {
//                return false;
//            }
//            var version = header[3];
//            osglayer._version = version;
//            var gl = osglayer._gl;
//            if(!gl){
//                return;
//            }
//            var aCount =  new Uint32Array(data,0,2);
//            var nPageCount = aCount[1];
//            var ab =  new Uint32Array(data,0,2+nPageCount*6);
//            if(pEntity._childrenPageLod.length == nPageCount){
//                for(var i = 0;i < nPageCount;i++){
//                    var pageLod = pEntity._childrenPageLod[i];
//                    var nBeginPos = i*6+2;
//                    var nOffset = ab[nBeginPos];
//                    var nIndexCount = ab[nBeginPos+1];
//                    var nVertexCount = ab[nBeginPos+2];
//                    var width = ab[nBeginPos+3];
//                    var height = ab[nBeginPos+4];
//                    var size = ab[nBeginPos+5];
//                    if(nIndexCount == 0){
//                        console.log('nindexcount == 0');
//                        pageLod._rangeList = Infinity;//表示这块区域下面没有数据了，是一块无效区域,无需再继续往下遍历
//                        continue;
//                    }
//                    var indexes = new Uint16Array(data,nOffset,nIndexCount);
//                    nOffset = nOffset + nIndexCount * 2;
//                    if(nIndexCount%2 == 1)
//                        nOffset += 2;
//                    var nSecondColorSize = 0;
//                    if(VERSION.S3M4 == version)
//                        nSecondColorSize = 4;
//                    var vertexes = new Float32Array(data,nOffset,nVertexCount*(5+nSecondColorSize));
//                    nOffset = nOffset + nVertexCount*(5+nSecondColorSize)*4;
//                    var pImageBuffer;
//                    pImageBuffer = new Uint8Array(data,nOffset,width*height/2);
//                    var texture = new DDSTexture(gl,width, height, pImageBuffer);
//                    var renderEntity = new RenderEntityPagedLOD({
//                        gl : gl,
//                        texture : texture,
//                        indexes : indexes,
//                        vertexes : vertexes,
//                        indexCount : nIndexCount,
//                        version : version,
//                        size : version == VERSION.S3M4 ? 9 : 5
//                    });
//                    renderEntity._drawCommand = new DrawCommand({
//                        boundingVolume : pageLod._boundingSphere,
//                        pass : Pass.OSGB,
//                        owner : renderEntity
//                    });
//                    pageLod._renderEntity = renderEntity;
//                }
//                pEntity._ready = true;
//            }
        };
    OsgbLayer.prototype.initShader = function(){
        var srcVertex= [
            'attribute vec3 aPosition;',
            'attribute vec2 aTexCoord;',
            'attribute vec4 aColor;',
            'uniform mat4 matModel;',
            'uniform mat4 matProj;',
            'uniform mat4 matModelView;',
            'uniform bool uIsPc;',
            'varying vec2 vTexCoord;',
            'varying vec4 vColor;',
            'void main() {',
            '    vec4 p = vec4(aPosition, 1.0);',
            '    gl_Position =   matProj * matModelView * p;',
            '   if(!uIsPc){ vTexCoord = vec2(aTexCoord.x, aTexCoord.y); }',
            '   else{ vTexCoord = vec2(aTexCoord.x, 1.0 - aTexCoord.y); }',
            '    vColor = aColor;',
            '}'
        ].join('\n');
        var srcFragment= [
            '#ifdef GL_ES',
            '    precision highp float;',
            '#endif',
            'uniform bool uIsPicking;',
            'uniform bool uHasSecondColor;',
            'uniform vec4 uPixels;',
            'uniform sampler2D uTexture;',
            'varying vec2 vTexCoord;',
            'varying vec4 vColor;',
            'void main() {',
            '    if(uIsPicking){',
            '        gl_FragColor = vColor;',
            '    }',
            '    else{',
            '        if(uHasSecondColor && uPixels.r < 255.0){',
            '            float r = abs(vColor.r - uPixels.r/255.0);',
            '            float g = abs(vColor.g - uPixels.g/255.0);',
            '            float b = abs(vColor.b - uPixels.b/255.0);',
            '            float a = abs(vColor.a - uPixels.a/255.0);',
            '            vec4 selColor = vec4(0.7,0.1,0.1,1.0);',
            '            if(r < 0.003 && g < 0.003 && b < 0.003 && a < 0.003){',
            '                gl_FragColor = texture2D(uTexture, vTexCoord)*selColor;',
            '            }',
            '            else{',
            '                gl_FragColor = texture2D(uTexture, vTexCoord);',
            '            }',
            '        }',
            '        else{',
            '            gl_FragColor = texture2D(uTexture, vTexCoord);',
            '        }',
            '    }',
            '}'
        ].join('\n');
        var gl = this._gl;
        function _createShader(shaderType, shaderSource)
        {
            var shader = gl.createShader(shaderType);
            if (!shader) { return null; }
            gl.shaderSource(shader, shaderSource);
            gl.compileShader(shader);

            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS) && !gl.isContextLost())
            {
                if (shaderType == gl.VERTEX_SHADER)
                {
                    alert("Vertex Shader " + gl.getShaderInfoLog(shader));
                }
                else if (shaderType == gl.FRAGMENT_SHADER)
                {
                    alert("Fragment Shader " + gl.getShaderInfoLog(shader));
                }
                else
                {
                    alert("Unknown Shader " + gl.getShaderInfoLog(shader));
                }
                return null;
            }

            return shader;
        }
        var vs = _createShader(gl.VERTEX_SHADER, srcVertex);
        var fs = _createShader(gl.FRAGMENT_SHADER, srcFragment);

        if (vs && fs)
        {
            var program = gl.createProgram();
            gl.attachShader(program, vs);
            gl.attachShader(program, fs);
            gl.deleteShader(vs);
            gl.deleteShader(fs);
            gl.bindAttribLocation(program, 0, "aPosition");
            gl.bindAttribLocation(program, 1, "aTexCoord");
            gl.linkProgram(program);
            if (!gl.getProgramParameter(program, gl.LINK_STATUS) && !gl.isContextLost())
            {
                alert(gl.getProgramInfoLog(this.program));
                return;
            }
            program.uIsPicking = gl.getUniformLocation(program, "uIsPicking");
            program.uHasSecondColor = gl.getUniformLocation(program, "uHasSecondColor");
            program.matModelView = gl.getUniformLocation(program, "matModelView");
            program.matProj = gl.getUniformLocation(program, "matProj");
            program.uPixels = gl.getUniformLocation(program, "uPixels");
            program.uIsPc = gl.getUniformLocation(program, "uIsPc");
            this._program = program;
        }
    };
    function isPCBroswer() {
        var sUserAgent = window.navigator.userAgent.toLowerCase();
        var bIsIpad = sUserAgent.match(/ipad/i) == "ipad";
        var bIsIphoneOs = sUserAgent.match(/iphone os/i) == "iphone os";
        var bIsMidp = sUserAgent.match(/midp/i) == "midp";
        var bIsUc7 = sUserAgent.match(/rv:1.2.3.4/i) == "rv:1.2.3.4";
        var bIsUc = sUserAgent.match(/ucweb/i) == "ucweb";
        var bIsAndroid = sUserAgent.match(/android/i) == "android";
        var bIsCE = sUserAgent.match(/windows ce/i) == "windows ce";
        var bIsWM = sUserAgent.match(/windows mobile/i) == "windows mobile";
        if (bIsIpad || bIsIphoneOs || bIsMidp || bIsUc7 || bIsUc || bIsAndroid || bIsCE || bIsWM) {
            return false;
        } else {
            return true;
        }
    }
    return OsgbLayer;
});

