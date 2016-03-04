/**
 * Created with JetBrains WebStorm.
 * User: Administrator
 * Date: 16-3-3
 * Time: 下午4:29
 * To change this template use File | Settings | File Templates.
 */
define([
    './DDSTexture'
],function(
    DDSTexture
    ){
    "use strict";
    /**
     * DDS纹理管理
     * @constructor
     */
    var DDSTextureManager = function(){
        this.textures = new Array();
        this.refCounts = new Array();
    };
    /**
     * 初始化DDS纹理
     */
    DDSTextureManager.CreateTexture = function(id,gl,width,height,imageBuffer,isPC){

        var origTex = g_TextureManager.textures[id];

        if(origTex)
        {
            g_TextureManager.refCounts[id]++;
        }
        else
        {
            origTex = new DDSTexture(id,gl,width, height, imageBuffer,isPC);
            g_TextureManager.refCounts[id] = 1;
            g_TextureManager.textures[id] = origTex;
        }
        return origTex;
    };

    DDSTextureManager.DestroyTexture = function(id)
    {
        var numInstances = g_TextureManager.refCounts[id];
        g_TextureManager.refCounts[id] = numInstances-1;

        if(g_TextureManager.refCounts[id] == 0)
        {
            //remove from textures array
            g_TextureManager.textures[id].destroy();
            delete(g_TextureManager.textures[id]);
            delete(g_TextureManager.refCounts[id]);
        }
    }

    var g_TextureManager = new DDSTextureManager();

    return DDSTextureManager;
});