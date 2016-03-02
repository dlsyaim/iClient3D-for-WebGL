/*global define*/
define([
    './createTaskProcessorWorker'
], function(
    createTaskProcessorWorker) {
    "use strict";

    importScripts("./zlib.min.js");

    function ab2str(buf) {
        return String.fromCharCode.apply(null, new Uint16Array(buf));
    }

    function dxtToRgb565(src, src16Offset, width, height) {
        var c = new Uint16Array(4);
        var dst = new Uint16Array(width * height);
        var nWords = (width * height) / 4;
        var m = 0;
        var dstI = 0;
        var i = 0;
        var r0 = 0, g0 = 0, b0 = 0, r1 = 0, g1 = 0, b1 = 0;

        var blockWidth = width / 4;
        var blockHeight = height / 4;
        for (var blockY = 0; blockY < blockHeight; blockY++) {
            for (var blockX = 0; blockX < blockWidth; blockX++) {
                i = src16Offset + 4 * (blockY * blockWidth + blockX);
                c[0] = src[i];
                c[1] = src[i + 1];
                r0 = c[0] & 0x1f;
                g0 = c[0] & 0x7e0;
                b0 = c[0] & 0xf800;
                r1 = c[1] & 0x1f;
                g1 = c[1] & 0x7e0;
                b1 = c[1] & 0xf800;
                // Interpolate between c0 and c1 to get c2 and c3.
                // Note that we approximate 1/3 as 3/8 and 2/3 as 5/8 for
                // speed.  This also appears to be what the hardware DXT
                // decoder in many GPUs does :)
                c[2] = ((5 * r0 + 3 * r1) >> 3)
                    | (((5 * g0 + 3 * g1) >> 3) & 0x7e0)
                    | (((5 * b0 + 3 * b1) >> 3) & 0xf800);
                c[3] = ((5 * r1 + 3 * r0) >> 3)
                    | (((5 * g1 + 3 * g0) >> 3) & 0x7e0)
                    | (((5 * b1 + 3 * b0) >> 3) & 0xf800);
                m = src[i + 2];
                dstI = (blockY * 4) * width + blockX * 4;
                dst[dstI] = c[m & 0x3];
                dst[dstI + 1] = c[(m >> 2) & 0x3];
                dst[dstI + 2] = c[(m >> 4) & 0x3];
                dst[dstI + 3] = c[(m >> 6) & 0x3];
                dstI += width;
                dst[dstI] = c[(m >> 8) & 0x3];
                dst[dstI + 1] = c[(m >> 10) & 0x3];
                dst[dstI + 2] = c[(m >> 12) & 0x3];
                dst[dstI + 3] = c[(m >> 14)];
                m = src[i + 3];
                dstI += width;
                dst[dstI] = c[m & 0x3];
                dst[dstI + 1] = c[(m >> 2) & 0x3];
                dst[dstI + 2] = c[(m >> 4) & 0x3];
                dst[dstI + 3] = c[(m >> 6) & 0x3];
                dstI += width;
                dst[dstI] = c[(m >> 8) & 0x3];
                dst[dstI + 1] = c[(m >> 10) & 0x3];
                dst[dstI + 2] = c[(m >> 12) & 0x3];
                dst[dstI + 3] = c[(m >> 14)];
            }
        }

        /*
         var nSwap;
         for (var blockY = 0; blockY < height/2; blockY++) {
         var nIndex = blockY * width;
         var nIndex2 = (height-blockY-1) * width;
         for (var blockX = 0; blockX < width; blockX++) {
         nSwap = dst[nIndex+blockX];
         dst[nIndex+blockX] = dst[nIndex2+blockX];
         dst[nIndex2+blockX] = nSwap;
         }
         }
         */
        return dst;
    };
    function osgbParser(parameters, transferableObjects) {

        var data = parameters.dataBuffer;
        var isPc = parameters.isPc;

//        var content = new Uint8Array(data);
//        content[3] = 0;
//
//        var deflate = new Zlib.Deflate(content);
//        var compressed = deflate.compress();
//
//        var inflate = new Zlib.Inflate(content);
//        var data2 = inflate.decompress();

        var header = new Uint8Array(data);
        if (header[0] != 115 || header[1] != 51 || header[2] != 109) {
            return {
                result:false
            };
        }
        var version = header[3];

        if(version == 0)
        {
            //var dataBB = new Uint8Array(parameters.dataBuffer,4);
            var dataZip = new Uint8Array(data,4);


            var inflate = new Zlib.Inflate(dataZip);
            data = inflate.decompress().buffer;
        }

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
            var pImageBuffer;
            if(isPc){
                pImageBuffer = new Uint8Array(data,nOffset,width*height/2);
            }
            else{
                pImageBuffer = new Uint16Array(data,nOffset,width*height/4);
                pImageBuffer = dxtToRgb565(pImageBuffer, 0, width, height);
            }

            var fCentre = null;
            var strName = null;

            if(version == 0)
            {
                nOffset = nOffset + size;
                fCentre = new Float32Array(data,nOffset,5);

                nOffset = nOffset + 4 * 5;
                var nFileNameCount = new Uint32Array(data,nOffset,1);

                nOffset = nOffset + 4;
                var codeFileName = new Uint8Array(data,nOffset,nFileNameCount[0]);

                strName = ab2str(codeFileName).split(".")[0];
            }

            var obj = {
                indexCount:nIndexCount,
                indexData:indexes,
                vertexData:vertexes,
                nWidth:width,
                nHeight:height,
                imageData:  pImageBuffer,
                boundingsphere:fCentre,
                strFileName:strName
            };

            arr.push(obj);
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