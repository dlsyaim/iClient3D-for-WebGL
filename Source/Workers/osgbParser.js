/*global define*/
define([
    './createTaskProcessorWorker'
], function(
    createTaskProcessorWorker) {
    "use strict";

    importScripts("./zlib.min.js");

    function osgbParser(parameters, transferableObjects) {

        var data = parameters.dataBuffer;

//        var content = new Uint8Array(data);
//
//        var deflate = new Zlib.Deflate(content);
//        var compressed = deflate.compress();
//
//        var inflate = new Zlib.Inflate(compressed);
//        data = inflate.decompress().buffer;

        var header = new Uint8Array(data);
        if (header[0] != 115 || header[1] != 51 || header[2] != 109) {
            return {
                result:false
            };
        }
        var version = header[3];

        var aCount =  new Uint32Array(data,0,2);
        var nPageCount = aCount[1];
        var ab =  new Uint32Array(data,0,2+nPageCount*6);

        var arr = [];

        for(var i = 0;i < nPageCount;i++){
            var nBeginPos = i*6+2;
            var nOffset = ab[nBeginPos];
            var nIndexCount = ab[nBeginPos+1];
            var nVertexCount = ab[nBeginPos+2];
            var width = ab[nBeginPos+3];
            var height = ab[nBeginPos+4];
            var size = ab[nBeginPos+5];
            if(nIndexCount == 0){
                continue;
            }
            var indexes = new Uint16Array(data,nOffset,nIndexCount);
            nOffset = nOffset + nIndexCount * 2;
            if(nIndexCount%2 == 1)
                nOffset += 2;
            var nSecondColorSize = 0;
            if(53 == version)
                nSecondColorSize = 4;

            var vertexes = new Float32Array(data,nOffset,nVertexCount*(5+nSecondColorSize));
            nOffset = nOffset + nVertexCount*(5+nSecondColorSize)*4;
            var pImageBuffer = new Uint8Array(data,nOffset,width*height/2);

            var obj = {
                indexCount:nIndexCount,
                indexData:indexes,
                vertexData:vertexes,
                nWidth:width,
                nHeight:height,
                imageData:  pImageBuffer
            };

            arr[i] = obj;
        }

        return {
            result:true,
            version:version,
            number: nPageCount,
            vbo: arr
        };
    }

    return createTaskProcessorWorker(osgbParser);
});
