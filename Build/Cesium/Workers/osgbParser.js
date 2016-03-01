/**
 * Cesium - https://github.com/AnalyticalGraphicsInc/cesium
 *
 * Copyright 2011-2015 Cesium Contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Columbus View (Pat. Pend.)
 *
 * Portions licensed separately.
 * See https://github.com/AnalyticalGraphicsInc/cesium/blob/master/LICENSE.md for full licensing details.
 */
!function(){define("Core/defined",[],function(){"use strict";var r=function(r){return void 0!==r};return r}),define("Core/freezeObject",["./defined"],function(r){"use strict";var e=Object.freeze;return r(e)||(e=function(r){return r}),e}),define("Core/defaultValue",["./freezeObject"],function(r){"use strict";var e=function(r,e){return void 0!==r?r:e};return e.EMPTY_OBJECT=r({}),e}),define("Core/formatError",["./defined"],function(r){"use strict";var e=function(e){var n,t=e.name,a=e.message;n=r(t)&&r(a)?t+": "+a:e.toString();var i=e.stack;return r(i)&&(n+="\n"+i),n};return e}),define("Workers/createTaskProcessorWorker",["../Core/defaultValue","../Core/defined","../Core/formatError"],function(r,e,n){"use strict";var t=function(t){var a,i=[],o={id:void 0,result:void 0,error:void 0};return function(s){var u=s.data;i.length=0,o.id=u.id,o.error=void 0,o.result=void 0;try{o.result=t(u.parameters,i)}catch(f){o.error=f instanceof Error?{name:f.name,message:f.message,stack:f.stack}:f}e(a)||(a=r(self.webkitPostMessage,self.postMessage)),u.canTransferArrayBuffer||(i.length=0);try{a(o,i)}catch(f){o.result=void 0,o.error="postMessage failed with error: "+n(f)+"\n  with responseMessage: "+JSON.stringify(o),a(o)}}};return t}),define("Workers/osgbParser",["./createTaskProcessorWorker"],function(r){"use strict";function e(r){return String.fromCharCode.apply(null,new Uint16Array(r))}function n(r,e,n,t){for(var a=new Uint16Array(4),i=new Uint16Array(n*t),o=0,s=0,u=0,f=0,c=0,d=0,v=0,l=0,y=0,w=n/4,g=t/4,m=0;g>m;m++)for(var A=0;w>A;A++)u=e+4*(m*w+A),a[0]=r[u],a[1]=r[u+1],f=31&a[0],c=2016&a[0],d=63488&a[0],v=31&a[1],l=2016&a[1],y=63488&a[1],a[2]=5*f+3*v>>3|2016&5*c+3*l>>3|63488&5*d+3*y>>3,a[3]=5*v+3*f>>3|2016&5*l+3*c>>3|63488&5*y+3*d>>3,o=r[u+2],s=4*m*n+4*A,i[s]=a[3&o],i[s+1]=a[3&o>>2],i[s+2]=a[3&o>>4],i[s+3]=a[3&o>>6],s+=n,i[s]=a[3&o>>8],i[s+1]=a[3&o>>10],i[s+2]=a[3&o>>12],i[s+3]=a[o>>14],o=r[u+3],s+=n,i[s]=a[3&o],i[s+1]=a[3&o>>2],i[s+2]=a[3&o>>4],i[s+3]=a[3&o>>6],s+=n,i[s]=a[3&o>>8],i[s+1]=a[3&o>>10],i[s+2]=a[3&o>>12],i[s+3]=a[o>>14];return i}function t(r){var t=r.dataBuffer,a=r.isPc,i=new Uint8Array(t);if(115!=i[0]||51!=i[1]||109!=i[2])return{result:!1};var o=i[3];if(0==o){var s=new Uint8Array(t,4),u=new Zlib.Inflate(s);t=u.decompress().buffer}for(var f=new Uint32Array(t,0,2),c=f[1],d=new Uint32Array(t,0,2+6*c),v=[],l=0;c>l;l++){var y=6*l+2,w=d[y],g=d[y+1],m=d[y+2],A=d[y+3],U=d[y+4],b=d[y+5];if(0!=g){var p=new Uint16Array(t,w,g);w+=2*g,1==g%2&&(w+=2);var C=0;53==o&&(C=4);var h=new Float32Array(t,w,m*(5+C));w+=4*m*(5+C);var k;a?k=new Uint8Array(t,w,A*U/2):(k=new Uint16Array(t,w,A*U/4),k=n(k,0,A,U));var P=null,E=null;if(0==o){w+=b,P=new Float32Array(t,w,5),w+=20;var M=new Uint32Array(t,w,1);w+=4;var O=new Uint8Array(t,w,M[0]);E=e(O).split(".")[0]}var T={indexCount:g,indexData:p,vertexData:h,nWidth:A,nHeight:U,imageData:k,boundingsphere:P,strFileName:E};v[l]=T}}return{result:!0,version:o,number:c,vbo:v}}return importScripts("./zlib.min.js"),r(t)})}();