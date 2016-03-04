define([
    '../Core/FeatureDetection'
],function(
    FeatureDetection
    ){
    "use strict";
    /**
     * DDS纹理对象
     * @param gl {WebGLRenderingContext}
     * @param width {Number} 纹理宽度
     * @param height {Number} 纹理高度
     * @param imageBuffer {Array} 纹理数据
     * @constructor
     */
    var DDSTexture = function(id,gl,width,height,imageBuffer,isPC){
        this._gl = gl;
        this._width = width;
        this._height = height;
        this._imageBuffer = imageBuffer;
        this.s3tc = null;
        this.vendorPrefixes = ["", "WEBKIT_", "MOZ_"];
        this.texture = null;
        this.ready = false;
        this.isPC = isPC;
        this.id = id;
        this.initTexture();
    };
    /**
     * 初始化DDS纹理
     */
    DDSTexture.prototype.initTexture = function(){
        if(this.s3tc == null)
        {
            var i, ext;
            var name = "WEBGL_compressed_texture_s3tc";
            for(i in this.vendorPrefixes) {
                ext = this._gl.getExtension(this.vendorPrefixes[i] + name);
                if (ext) {
                    this.s3tc = ext;
                    break;
                }
            }
        }
        var gl = this._gl;
        this.texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        var ext = this.s3tc;
        var internalFormat = ext ? ext.COMPRESSED_RGB_S3TC_DXT1_EXT : null;
        var texWidth = this._width;
        var texHeight = this._height;
        var imageBuffer = this._imageBuffer;
        if(this.isPC){
            gl.compressedTexImage2D(gl.TEXTURE_2D, 0, internalFormat, texWidth, texHeight, 0, imageBuffer);
        }
        else{
            //var rgb565Data = this.dxtToRgb565(imageBuffer, 0, texWidth, texHeight);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, texWidth, texHeight, 0, gl.RGB, gl.UNSIGNED_SHORT_5_6_5, imageBuffer);
        }

        //gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        //gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
        //gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);

        gl.bindTexture(gl.TEXTURE_2D, null);
        this.ready = true;
    };
    DDSTexture.prototype.dxtToRgb565 = function (src, src16Offset, width, height) {
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
    /**
     * 释放资源
     */
    DDSTexture.prototype.destroy = function()
    {
        this._gl.deleteTexture(this.texture);
        this.texture = null;
        this.ready = false;
        this.id = 0;
    };
    /**
     * 激活纹理单元
     */
    DDSTexture.prototype.enable = function(){
        if (this.ready)
        {
            this._gl.activeTexture(this._gl.TEXTURE0);
            this._gl.bindTexture(this._gl.TEXTURE_2D, this.texture);
        }
    };
    DDSTexture.prototype.disable = function()
    {
        if (this.ready)
        {
            this._gl.bindTexture(this._gl.TEXTURE_2D, null);
        }
    }

    return DDSTexture;
});