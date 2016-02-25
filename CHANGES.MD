Change Log
==========
### b1.1 - 2016-2-23
*Modify
    * 修改鼠标中键事件：
        this._maximumRotateRate = 1.77;改为this._maximumRotateRate = 0.618;
        function rotate3D()的camera.rotateUp(deltaTheta);改为camera.rotateUp(-deltaTheta);
        function tilt3DOnTerrain()的if (dot < 0.0) {改为if (dot > 0.0)
### b1.0 - 2016-01-22
* Added
    * 增加Source/Osgb/OsgbLayer.js模块
    * 增加Source/Osgb/DDSTexture.js模块
    * 增加Source/Handler/PolygonHandler.js模块
    * 增加Source/Handler/PolylineHandler.js模块
    * 增加Source/Widgets/PathQuery/PathQuery.js模块
    * 增加Source/Widgets/PathQuery/PathQueryViewModel.js模块
    * 增加Source/Widgets/PathQuery/PathQuery.css样式文件
    * 增加Source/Convert/cesiumToSuperMap.js模块
    * 增加Source/Convert/supermapToCesium.js模块
    * 增加Source/Scene/SuperMapImageryProvider.js模块
    * 增加Source/Scene/HereMapImageryProvider.js模块
* Modify
    * 修改Source/Scene/Scene.js模块：
        在function executeCommands中增加Pass.OSGB的command的render；
        在function updatePrimitives中增加scene.osgbLayer的update；
        修改var rectangleWidth = 3.0为1.0，var rectangleHeight = 3.0为1.0；
        在Scene.prototype.pick function中，增加this.osgbLayer.pixels = context.pixels;
        增加Scene.prototype.addOsgbLayer function;
        增加Scene.prototype.addOsbgLayerByScp；
    * 修改Source/Scene/Pass.js模块：
        增加类型Pass.OSGB = 6
    * 修改Source/Scene/WebMapServiceImageryProvider.js模块：
        修改buildImageUrl function的var url = imageryProvider._url.replace('[subdomain]', subdomains[(col + row + level) % subdomains.length]);
    * 修改Widgets/BaseLayerPicker/createDefaultImageryProviderViewModels.js模块：
        在createDefaultImageryProviderViewModels function中providerViewModels数组中push了一个SingleTileImageryProvider，作为默认的baselayer
    * 修改Widgets/Geocoder/GeocoderViewModel.js模块：
        在this._searchCommand = createCommand() function中，修改geocode(that)为geocodeSuperMapOL(that);
        增加geocodeSuperMapOL() function；
    * 修改Source/Widgets/Viewer/viewer.js模块：
        默认不加载geocoder控件，if (!defined(options.geocoder) || options.geocoder !== false) 修改为if (defined(options.geocoder) && options.geocoder !== false)
        默认不加载homeButton控件，if (!defined(options.homeButton) || options.homeButton !== false)  修改为if (defined(options.homeButton) && options.homeButton !== false)
        默认不加载baseLayerPicker控件，var createBaseLayerPicker = (!defined(options.globe) || options.globe !== false) && (!defined(options.baseLayerPicker) || options.baseLayerPicker !== false); 改为 var createBaseLayerPicker = (!defined(options.globe) || options.globe !== false) && (defined(options.baseLayerPicker) && options.baseLayerPicker !== false);
        默认不加载navigationHelpButton控件，if (!defined(options.navigationHelpButton) || options.navigationHelpButton !== false)改为if (defined(options.navigationHelpButton) && options.navigationHelpButton !== false)
        默认不加载animation控件，if (!defined(options.animation) || options.animation !== false)改为if (defined(options.animation) && options.animation !== false)
        默认不加载timeline控件，if (!defined(options.timeline) || options.timeline !== false)改为if (defined(options.timeline) && options.timeline !== false)
        默认不加载fullscreenButton控件，if (!defined(options.fullscreenButton) || options.fullscreenButton !== false) 改为 if (defined(options.fullscreenButton) && options.fullscreenButton !== false)
        添加pathQuery控件，默认不加载if (defined(options.pathQuery) && options.pathQuery !== false)
    * 修改Source/Widgets/CesiumWidget/CesiumWidget.js模块：
        修改默认加载的imageryProvider，原来是imageryProvider是BingMapsImageryProvider改为SingleTileImageryProvider