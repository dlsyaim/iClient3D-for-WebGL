#version 120
#ifdef GL_SL
    precision highp float;
#endif
uniform bool uIsPicking;
uniform bool uHasSecondColor;
uniform vec4 uPixels;
uniform sampler2D uTexture;
varying vec3 uTexCoord;
varying vec4 vColor;
void main() {
    if(uIsPicking){
        gl_FragColor = vColor;
    }
    else{
        if(uHasSecondColor && uPixels.r < 0.98){
            float r = abs(vColor.r - uPixels.r/255.0);
            float g = abs(vColor.g - uPixels.g/255.0);
            float b = abs(vColor.b - uPixels.b/255.0);
            float a = abs(vColor.a - uPixels.a/255.0);
            vec4 selColor = vec4(0.7,0.1,0.1,1.0);
            if(r < 0.003 && g < 0.003 && b < 0.003 && a < 0.003){
                gl_FragColor = texture2D(uTexture, vTexCoord)*selColor;
            }
            else{
                gl_FragColor = texture2D(uTexture, vTexCoord);
            }
        }
        else{
            gl_FragColor = texture2D(uTexture, vTexCoord);
        }
    }
}