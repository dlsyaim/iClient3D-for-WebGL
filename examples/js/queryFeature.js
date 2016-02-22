var viewer,selectedEntity;
function onload(Cesium) {
    viewer = new Cesium.Viewer('cesiumContainer');
    var scene = viewer.scene;
    var widget = viewer.cesiumWidget;
    selectedEntity = viewer.entities.add({
        name : 'selected'
    });
    try{
        var promise = scene.addOsbgLayerByScp('http://localhost:8090/iserver/services/3D-masaidth/rest/realspace/datas/masaidantihua/config');
        Cesium.when(promise,function(layer){
        },function(e){
            if (widget._showRenderLoopErrors) {
                var title = 'An error occurred while rendering.  Rendering has stopped.';
                widget.showErrorPanel(title, undefined, e);
            }
        });
    }
    catch(e){
        if (widget._showRenderLoopErrors) {
            var title = 'An error occurred while rendering.  Rendering has stopped.';
            widget.showErrorPanel(title, undefined, e);
        }
    }
    var handler = new Cesium.ScreenSpaceEventHandler(scene.canvas);
    var restUrl = 'http://localhost:8090/iserver/services/data-masaidth/rest/data/';//向iserver查询属性的数据集地址
    handler.setInputAction(function(evt) {
        setTimeout(function(){
            var id = getId(scene.osgbLayer);
            if(id){
                var pars = {
                    returnContent: true,
                    datasetNames: ["vector:vectorR"],//数据源，数据集
                    fromIndex: 0,
                    toIndex:-1,
                    IDs: [id]
                };
                var getFeaturesByIDsParameters, getFeaturesByIDsService;
                getFeaturesByIDsParameters = new SuperMap.REST.GetFeaturesByIDsParameters(pars);
                getFeaturesByIDsService = new SuperMap.REST.GetFeaturesByIDsService(restUrl, {
                    eventListeners: {"processCompleted": handlerGetFeaturesOk, "processFailed": handlerGetFeaturesFailed}});
                getFeaturesByIDsService.processAsync(getFeaturesByIDsParameters);
            }

        },50);
        cancleEnent(evt);
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
}
function cancleEnent(evt){
    evt = evt ? evt : window.event;
    if (evt.stopPropagation)
        evt.stopPropagation();
    if (evt.preventDefault)
        evt.preventDefault();
    evt.cancelBubble = true;
    evt.cancel = true;
    evt.returnValue = false;
    return false;
}
//获取OSGBLAYER单体化ID
function getId(osgbLayer){
    var id;
    if(osgbLayer){
        var nValue = osgbLayer.pixels;
        var red = nValue[0].toString(16);
        red = red.length == 1 ? '0' + red : red;
        var green = nValue[1].toString(16);
        green = green.length == 1 ? '0' + green : green;
        var blue = nValue[2].toString(16);
        blue = blue.length == 1 ? '0' + blue : blue;
        var alpha = nValue[3].toString(16);
        alpha = alpha.length == 1 ? '0' + alpha : alpha;
        id = alpha + blue + green + red;
        id = parseInt(id,16);
    }
    return id;
}
//查询成功处理函数
function handlerGetFeaturesOk(getFeaturesEventArgs){
    var i, len, features, feature, result = getFeaturesEventArgs.result;
    if (result && result.features) {
        if(result.featureCount > 0){
            features = result.features
            for (i=0, len=features.length; i<len; i++) {
                feature = features[i];
                var data = feature.data;//属性信息
                var descriptionStr = [];
                for(var key in data){
                    descriptionStr.push(key + ' : ' + data[key]);
                }
                descriptionStr = descriptionStr.join('</br>');
                selectedEntity.description = descriptionStr;
                selectedEntity.name = 'SMID' + data['SMID'];
                viewer.selectedEntity = selectedEntity;
            }
        }
    }
}
function handlerGetFeaturesFailed(){
    alert('属性查询失败');
}